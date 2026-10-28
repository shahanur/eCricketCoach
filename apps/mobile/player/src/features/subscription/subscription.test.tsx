import { fireEvent, render } from "@testing-library/react-native";

import { ApiError } from "../../api/api-error";
import { secureSessionStorage } from "../../session/secure-session-storage";
import { getPlayerSubscription, type PlayerSubscription } from "./subscription-api";
import { SubscriptionContent } from "./subscription-screen";

jest.mock("../../session/secure-session-storage", () => ({
  secureSessionStorage: { getAccessToken: jest.fn() },
}));
jest.mock("../../session/session-context", () => ({ useSession: jest.fn() }));
jest.mock("./use-subscription", () => ({ useSubscription: jest.fn() }));
jest.mock("../web-app/open-web-app-button", () => ({ OpenWebAppButton: () => null }));

const activeSubscription: PlayerSubscription = {
  status: "ACTIVE",
  source: "DEVELOPMENT_APPROVAL",
  paymentVerified: false,
  plan: {
    id: "INDIVIDUAL", name: "Individual Player", currency: "GBP",
    priceMonthlyMinor: 1499, billingCycle: "MONTHLY", profileLimit: 1, monthlyAnalysisLimit: 5,
  },
  period: { startsAt: "2026-10-28T16:00:00.000Z", endsAt: "2026-11-28T16:00:00.000Z" },
  autoRenews: false,
  capabilities: { purchase: false, restorePurchases: false, analysis: false },
};

describe("subscription API", () => {
  const originalOrigin = process.env.EXPO_PUBLIC_API_URL;
  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
    jest.mocked(secureSessionStorage.getAccessToken).mockResolvedValue("player-session");
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalOrigin === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalOrigin;
  });
  const respond = (body: unknown, status = 200) =>
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it("requests only the authenticated player's subscription, without accepting a player ID", async () => {
    const fetchMock = respond(activeSubscription);
    await expect(getPlayerSubscription()).resolves.toEqual(activeSubscription);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/api/player/subscription");
    expect(options?.headers).toMatchObject({ Authorization: "Bearer player-session" });
  });

  it("does not issue an anonymous request when secure storage has no session", async () => {
    jest.mocked(secureSessionStorage.getAccessToken).mockResolvedValue(null);
    const fetchMock = respond(activeSubscription);
    await expect(getPlayerSubscription()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 403, 429, 500])("propagates HTTP %s instead of returning a fake subscription", async (status) => {
    respond({ error: "Diagnostic only" }, status);
    await expect(getPlayerSubscription()).rejects.toMatchObject({ kind: "http", status });
  });

  it.each([
    { ...activeSubscription, status: "PAID" },
    { ...activeSubscription, period: null },
    { ...activeSubscription, period: { startsAt: "2026-11-28T16:00:00.000Z", endsAt: "2026-10-28T16:00:00.000Z" } },
    { ...activeSubscription, paymentVerified: true },
    { ...activeSubscription, capabilities: { ...activeSubscription.capabilities, purchase: true } },
  ])("rejects malformed or unsupported subscription contracts", async (body) => {
    respond(body);
    await expect(getPlayerSubscription()).rejects.toMatchObject({ kind: "invalid-response" });
  });
});

describe("player subscription dashboard", () => {
  it("shows a real active plan with expiry and a working refresh action", async () => {
    const onRetry = jest.fn();
    const onSignOut = jest.fn();
    const screen = await render(
      <SubscriptionContent
        state={{ status: "ready", subscription: activeSubscription }}
        onRetry={onRetry} onSignOut={onSignOut} signOutError={null}
      />,
    );
    expect(screen.getByText("Subscription")).toBeTruthy();
    expect(screen.getByText("Individual Player")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText(/This plan does not renew automatically/)).toBeTruthy();
    expect(screen.queryByText(/remaining|paid|mock|API|token/i)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Refresh plan" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("shows expired access without claiming an automatic renewal or usage reset", async () => {
    const screen = await render(
      <SubscriptionContent
        state={{ status: "ready", subscription: { ...activeSubscription, status: "EXPIRED" } }}
        onRetry={jest.fn()} onSignOut={jest.fn()} signOutError={null} profile
      />,
    );
    expect(screen.getByText("Your account")).toBeTruthy();
    expect(screen.getByText("Expired")).toBeTruthy();
    expect(screen.getByText(/Contact eCricketCoach to renew/)).toBeTruthy();
  });

  it.each(["INACTIVE", "UNAVAILABLE"] as const)("deliberately renders %s access", async (status) => {
    const screen = await render(
      <SubscriptionContent
        state={{ status: "ready", subscription: { ...activeSubscription, status, source: "NONE", period: null } }}
        onRetry={jest.fn()} onSignOut={jest.fn()} signOutError={null}
      />,
    );
    expect(screen.getByText("Not active")).toBeTruthy();
    expect(screen.queryByText(/Access until/)).toBeNull();
  });

  it("renders a loading indicator", async () => {
    const screen = await render(
      <SubscriptionContent state={{ status: "loading" }} onRetry={jest.fn()} onSignOut={jest.fn()} signOutError={null} />,
    );
    expect(screen.getByLabelText("Loading your plan")).toBeTruthy();
  });

  it("renders friendly offline errors without diagnostic text", async () => {
    const retry = jest.fn();
    const screen = await render(
      <SubscriptionContent
        state={{ status: "error", error: new ApiError("Sensitive diagnostic text", "network") }}
        onRetry={retry} onSignOut={jest.fn()} signOutError={null}
      />,
    );
    expect(screen.getByText(/You appear to be offline/)).toBeTruthy();
    expect(screen.queryByText("Sensitive diagnostic text")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("provides reauthentication for an expired session and displays sign-out failures", async () => {
    const signOut = jest.fn();
    const screen = await render(
      <SubscriptionContent
        state={{ status: "error", error: new ApiError("Expired", "http", 401) }}
        onRetry={jest.fn()} onSignOut={signOut} signOutError="We couldn't sign you out. Please try again."
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Sign in again" }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByText("We couldn't sign you out. Please try again.")).toBeTruthy();
  });
});
