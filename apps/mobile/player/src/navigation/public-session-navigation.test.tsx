import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";

import PublicLayout from "../app/(public)/_layout";
import MockAccessUnavailableScreen from "../app/(public)/access-unavailable";
import MockApprovalScreen from "../app/(public)/approval";
import MockSessionVerificationScreen from "../app/(public)/session-verification";
import { getPlayerAccess } from "../features/auth/player-session-api";
import { clearDeviceGoogleCredentialState } from "../platform/google-identity";
import { secureSessionStorage } from "../session/secure-session-storage";
import { SessionProvider } from "../session/session-context";

let mockScreen = "access-unavailable";
jest.mock("expo-router", () => ({
  useSegments: () => ["(public)", mockScreen],
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
    return <Text>{`Redirect: ${href}`}</Text>;
  },
  Stack: () => {
    if (mockScreen === "approval") return <MockApprovalScreen />;
    if (mockScreen === "session-verification") return <MockSessionVerificationScreen />;
    return <MockAccessUnavailableScreen />;
  },
}));
jest.mock("../features/auth/player-session-api", () => ({ getPlayerAccess: jest.fn() }));
jest.mock("../platform/google-identity", () => ({ clearDeviceGoogleCredentialState: jest.fn() }));
jest.mock("../session/secure-session-storage", () => ({
  secureSessionStorage: {
    getAccessToken: jest.fn(),
    setAccessToken: jest.fn(),
    clearAccessToken: jest.fn(),
  },
}));
jest.mock("../features/web-app/open-web-app-button", () => ({ OpenWebAppButton: () => null }));

describe("public session screen navigation", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockScreen = "access-unavailable";
    jest.mocked(secureSessionStorage.getAccessToken).mockResolvedValue("old-session");
    jest.mocked(secureSessionStorage.clearAccessToken).mockResolvedValue(undefined);
    jest.mocked(clearDeviceGoogleCredentialState).mockResolvedValue(undefined);
    jest.mocked(getPlayerAccess).mockResolvedValue({
      access: "UNAVAILABLE", email: "player@example.test", displayName: null,
    });
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    jest.resetAllMocks();
  });

  const mount = () => render(
    <QueryClientProvider client={client}>
      <SessionProvider><PublicLayout /></SessionProvider>
    </QueryClientProvider>,
  );

  it("leaves the plan-unavailable screen as soon as the session is cleared, without waiting for Google", async () => {
    let finishGoogleReset: (() => void) | undefined;
    jest.mocked(clearDeviceGoogleCredentialState).mockImplementation(() => new Promise((resolve) => {
      finishGoogleReset = resolve;
    }));
    const screen = await mount();
    await waitFor(() => expect(getPlayerAccess).toHaveBeenCalledWith("old-session"));
    await act(() => { client.setQueryData(["private-player-data"], { name: "private" }); });
    await fireEvent.press(screen.getByText("Sign out"));
    await waitFor(() => expect(screen.getByText("Redirect: /(public)/welcome")).toBeTruthy());
    expect(secureSessionStorage.clearAccessToken).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(["private-player-data"])).toBeUndefined();
    expect(screen.queryByText("Player access unavailable")).toBeNull();
    expect(clearDeviceGoogleCredentialState).toHaveBeenCalledTimes(1);
    await act(() => finishGoogleReset?.());
  });

  it("keeps the screen and shows an actionable error if secure session removal fails", async () => {
    jest.mocked(secureSessionStorage.clearAccessToken).mockRejectedValue(new Error("storage detail"));
    const screen = await mount();
    await waitFor(() => expect(getPlayerAccess).toHaveBeenCalled());
    await fireEvent.press(screen.getByText("Sign out"));
    await waitFor(() => expect(screen.getByText("We couldn't sign you out. Please try again.")).toBeTruthy());
    expect(screen.queryByText("Redirect: /(public)/welcome")).toBeNull();
    expect(clearDeviceGoogleCredentialState).not.toHaveBeenCalled();
    jest.mocked(secureSessionStorage.clearAccessToken).mockResolvedValue(undefined);
    await fireEvent.press(screen.getByText("Sign out"));
    await waitFor(() => expect(screen.getByText("Redirect: /(public)/welcome")).toBeTruthy());
  });

  it("still redirects after local sign-out when resetting Google account selection fails", async () => {
    jest.mocked(clearDeviceGoogleCredentialState).mockRejectedValue(new Error("Google unavailable"));
    const screen = await mount();
    await waitFor(() => expect(getPlayerAccess).toHaveBeenCalled());
    await fireEvent.press(screen.getByText("Sign out"));
    await waitFor(() => expect(screen.getByText("Redirect: /(public)/welcome")).toBeTruthy());
  });

  it.each(["access-unavailable", "approval", "session-verification"])(
    "redirects signed-out visitors away from %s, including Android back navigation",
    async (route) => {
      mockScreen = route;
      jest.mocked(secureSessionStorage.getAccessToken).mockResolvedValue(null);
      const screen = await mount();
      await waitFor(() => expect(screen.getByText("Redirect: /(public)/welcome")).toBeTruthy());
      expect(getPlayerAccess).not.toHaveBeenCalled();
    },
  );

  it("takes an approved player away from public screens to Home", async () => {
    mockScreen = "sign-in";
    jest.mocked(getPlayerAccess).mockResolvedValue({
      access: "ACTIVE", email: "player@example.test", displayName: "Asha",
    });
    const screen = await mount();
    await waitFor(() => expect(screen.getByText("Redirect: /(app)/(tabs)/home")).toBeTruthy());
  });

  it("preserves public sign-in navigation for a signed-out player", async () => {
    mockScreen = "sign-in";
    jest.mocked(secureSessionStorage.getAccessToken).mockResolvedValue(null);
    const screen = await mount();
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText(/^Redirect:/)).toBeNull();
  });

  it("explains admin/club account rejection rather than claiming the plan is inactive", async () => {
    jest.mocked(getPlayerAccess).mockResolvedValue({
      access: "UNAVAILABLE", email: "admin@example.test", displayName: null,
      reason: "ACCOUNT_TYPE_MISMATCH",
    });
    const screen = await mount();
    await waitFor(() => expect(screen.getByText("Use your player account")).toBeTruthy());
    expect(screen.getByText(/administrator or club account/)).toBeTruthy();
    expect(screen.queryByText("Your plan isn’t active")).toBeNull();
    await fireEvent.press(screen.getByText("Sign out"));
    await waitFor(() => expect(screen.getByText("Redirect: /(public)/welcome")).toBeTruthy());
  });
});
