import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import { ApiError } from "../../api/api-error";
import type { PlayerProfile } from "../profile/player-profile-api";
import type { PlayerSubscription } from "../subscription/subscription-api";
import { DashboardContent } from "./dashboard-screen";
import type { DashboardSection } from "./use-dashboard";

jest.mock("expo-router", () => ({ router: { navigate: jest.fn() } }));

const profile: PlayerProfile = {
  id: "self", displayName: "Asha Player", battingHandedness: "RIGHT", bowlingStyle: "NOT_SET",
  primaryDisciplines: ["BATTING"], experienceLevel: "DEVELOPING", goals: ["Improve footwork"],
  isComplete: true, version: 1, createdAt: "2026-10-28T12:00:00.000Z", updatedAt: "2026-10-28T12:00:00.000Z",
};
const subscription: PlayerSubscription = {
  status: "ACTIVE", source: "DEVELOPMENT_APPROVAL", paymentVerified: false, autoRenews: false,
  period: { startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-11-01T00:00:00.000Z" },
  plan: {
    id: "INDIVIDUAL", name: "Individual Player", currency: "GBP", priceMonthlyMinor: 1499,
    billingCycle: "MONTHLY", profileLimit: 1, monthlyAnalysisLimit: 5,
  },
  capabilities: { purchase: false, restorePurchases: false, analysis: false },
};
const ready = <T,>(data: T): DashboardSection<T> => ({ status: "ready", data, updatedAt: 1_798_000_000_000 });

function content(overrides: Partial<Parameters<typeof DashboardContent>[0]> = {}) {
  return <DashboardContent
    profile={ready(profile)} subscription={ready(subscription)}
    onRefreshProfile={jest.fn()} onRefreshSubscription={jest.fn()} onSignOut={jest.fn()}
    signOutError={null} {...overrides}
  />;
}

describe("self-player dashboard", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-28T12:00:00.000Z"));
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it("shows only verified goals, discipline selections and plan limits, not invented progress or usage", async () => {
    const screen = await render(content());
    expect(screen.getByText("Asha Player")).toBeTruthy();
    expect(screen.getByText("Improve footwork")).toBeTruthy();
    expect(screen.getAllByText("Stage and progress: coming soon")).toHaveLength(4);
    expect(screen.getAllByText("Selected training focus")).toHaveLength(1);
    expect(screen.getByText("Individual Player: Active")).toBeTruthy();
    expect(screen.getByText("Monthly AI allowance: 5 video actions in the Individual Player plan.")).toBeTruthy();
    expect(screen.getByText(/Usage, remaining actions and the next allowance reset are unavailable/)).toBeTruthy();
    expect(screen.queryByText(/0 of 5|5 remaining|100%|0 sessions/)).toBeNull();
    expect(screen.getByText(/Milestones and certificates are coming soon/)).toBeTruthy();
  });

  it("offers an actionable first-time state without treating saved preferences as achievements", async () => {
    const screen = await render(content({
      profile: ready({ ...profile, isComplete: false, primaryDisciplines: [], goals: [] }),
    }));
    expect(screen.getByText(/Start your journey by choosing/)).toBeTruthy();
    expect(screen.getByText(/No goals added yet/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Complete your profile"));
    expect(router.navigate).toHaveBeenCalledWith("/(app)/(tabs)/profile");
  });

  it("navigates to released screens with explicit coming-soon labels and disables unavailable history", async () => {
    const screen = await render(content());
    for (const [label, route] of [
      ["Explore practice: Coming soon", "practice"],
      ["View roadmap: Coming soon", "progress"],
      ["Record or upload: Coming soon", "analyze"],
      ["Manage profile and plan", "profile"],
    ]) {
      await fireEvent.press(screen.getByText(label));
      expect(router.navigate).toHaveBeenLastCalledWith(`/(app)/(tabs)/${route}`);
    }
    expect(screen.getByRole("button", { name: "Analysis history: Coming soon", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByText("Analysis history: Coming soon"));
    expect(router.navigate).toHaveBeenCalledTimes(4);
  });

  it("keeps a failed section explicit and independently retryable", async () => {
    const retry = jest.fn();
    const screen = await render(content({
      profile: { status: "error", error: new ApiError("diagnostic SQL detail", "http", 500) },
      onRefreshProfile: retry,
    }));
    expect(screen.getByText("Individual Player: Active")).toBeTruthy();
    expect(screen.queryByText("Asha Player")).toBeNull();
    expect(screen.queryByText(/diagnostic SQL/)).toBeNull();
    await fireEvent.press(screen.getByText("Retry your player profile"));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/0 sessions/)).toBeNull();
  });

  it("shows loading independently rather than replacing missing details with zeros", async () => {
    const screen = await render(content({ subscription: { status: "loading" } }));
    expect(screen.getByText("Loading your plan and allowance...")).toBeTruthy();
    expect(screen.getByText("Asha Player")).toBeTruthy();
    expect(screen.queryByText(/Monthly AI allowance/)).toBeNull();
  });

  it("labels offline snapshots with a timestamp and does not claim current entitlement", async () => {
    const screen = await render(content({
      subscription: {
        status: "error", error: new ApiError("offline", "network"),
        cached: { data: subscription, updatedAt: 1_798_000_000_000 },
      },
    }));
    expect(screen.getByText(/You appear to be offline/)).toBeTruthy();
    expect(screen.getByText(/Showing saved details from .*These may be out of date/)).toBeTruthy();
    expect(screen.getByText("Retry your plan and allowance")).toBeTruthy();
  });

  it.each([401, 403])("hides all saved dashboard data when access is rejected (%s)", async (status) => {
    const signOut = jest.fn();
    const screen = await render(content({
      subscription: { status: "error", error: new ApiError("private diagnostic", "http", status) },
      onSignOut: signOut,
      signOutError: "We couldn't sign you out. Please try again.",
    }));
    expect(screen.queryByText("Asha Player")).toBeNull();
    expect(screen.queryByText("Improve footwork")).toBeNull();
    await fireEvent.press(screen.getByText(status === 401 ? "Sign in again" : "Return to sign in"));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByText("We couldn't sign you out. Please try again.")).toBeTruthy();
  });

  it("treats a passed access boundary as expired even before the refreshed response arrives", async () => {
    const screen = await render(content({
      subscription: ready({
        ...subscription,
        period: { startsAt: "2026-09-01T00:00:00.000Z", endsAt: "2026-10-01T00:00:00.000Z" },
      }),
    }));
    expect(screen.getByText("Individual Player: Expired")).toBeTruthy();
    expect(screen.getByText(/Your access has ended/)).toBeTruthy();
    expect(screen.queryByText(/Your approved access covers/)).toBeNull();
  });

  it("expires an offline plan snapshot while the screen remains open", async () => {
    const screen = await render(content({
      subscription: {
        status: "error", error: new ApiError("offline", "network"),
        cached: {
          data: {
            ...subscription,
            period: { startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-10-28T12:00:10.000Z" },
          },
          updatedAt: Date.now(),
        },
      },
    }));
    expect(screen.getByText("Individual Player: Active")).toBeTruthy();
    await act(async () => { await jest.advanceTimersByTimeAsync(10_000); });
    expect(screen.getByText("Individual Player: Expired")).toBeTruthy();
  });

  it.each(["INACTIVE", "UNAVAILABLE"] as const)("distinguishes %s plans without inventing access or billing periods", async (status) => {
    const screen = await render(content({
      subscription: ready({ ...subscription, status, source: "NONE", period: null }),
    }));
    expect(screen.getByText(`Individual Player: ${status === "INACTIVE" ? "Not active" : "Unavailable"}`)).toBeTruthy();
    expect(screen.queryByText(/Access until|Access ended/)).toBeNull();
    expect(screen.queryByText(/Your approved access covers/)).toBeNull();
  });
});
