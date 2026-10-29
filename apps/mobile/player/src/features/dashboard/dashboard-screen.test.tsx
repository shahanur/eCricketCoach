import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import { ApiError } from "../../api/api-error";
import type { PlayerProfile } from "../profile/player-profile-api";
import type { PlayerSubscription } from "../subscription/subscription-api";
import type { PlayerDashboard } from "./dashboard-api";
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
const demo: PlayerDashboard = {
  source: "DEVELOPMENT_SEED", progress: { percent: 72, stage: "Developing Player" },
  focus: { title: "Front Foot Drive Drill", discipline: "Batting", minutes: 15, description: "Sample practice focus." },
  notification: "Your sample training focus is ready.",
};
const empty: PlayerDashboard = { source: "NONE", progress: null, focus: null, notification: null };
const ready = <T,>(data: T): DashboardSection<T> => ({ status: "ready", data, updatedAt: 1_798_000_000_000 });

function content(overrides: Partial<Parameters<typeof DashboardContent>[0]> = {}) {
  return <DashboardContent
    profile={ready(profile)} subscription={ready(subscription)} overview={ready(demo)}
    onRefreshProfile={jest.fn()} onRefreshSubscription={jest.fn()} onRefreshOverview={jest.fn()}
    onSignOut={jest.fn()} signOutError={null} {...overrides}
  />;
}

describe("reference player home", () => {
  beforeEach(() => jest.clearAllMocks());

  it("includes the reference greeting, stage, focus, notification and all four quick actions", async () => {
    const screen = await render(content());
    expect(screen.getByText("Welcome back,\nAsha \uD83D\uDC4B")).toBeTruthy();
    expect(screen.getByText("Keep practicing. You're on track\nto reach the next stage.")).toBeTruthy();
    expect(screen.getByText("Current Stage")).toBeTruthy();
    expect(screen.getByText("Developing Player")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ min: 0, max: 100, now: 72 });
    expect(screen.getByText("72%")).toBeTruthy();
    expect(screen.getByText("Today's Focus")).toBeTruthy();
    expect(screen.getByText("Front Foot Drive Drill")).toBeTruthy();
    expect(screen.getByText("Batting \u00B7 15 min")).toBeTruthy();
    expect(screen.getByRole("image", { name: "Batter practising a front foot drive" })).toBeTruthy();
    expect(screen.getByText(/Demo data/)).toBeTruthy();
    expect(screen.getByTestId("notification-dot")).toBeTruthy();
    for (const label of ["Record Video", "Upload from Drive", "Practice Drills", "View Analysis"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
    expect(screen.queryByText("Your performance")).toBeNull();
    expect(screen.queryByText(/Monthly AI allowance/)).toBeNull();
  });

  it("wires every navigation action to the appropriate protected destination", async () => {
    const screen = await render(content());
    for (const [label, route] of [
      ["View Roadmap", "progress"], ["See all practice drills", "practice"],
      ["Record Video", "analyze"], ["Upload from Drive", "analyze"],
      ["Practice Drills", "practice"], ["View Analysis", "analyze"],
    ]) {
      await fireEvent.press(screen.getByRole("button", { name: label }));
      expect(router.navigate).toHaveBeenLastCalledWith(`/(app)/(tabs)/${route}`);
    }
    expect(router.navigate).toHaveBeenCalledTimes(6);
  });

  it("opens focus details without claiming a completed practice session", async () => {
    const screen = await render(content());
    await fireEvent.press(screen.getByRole("button", { name: "Front Foot Drive Drill, Batting, 15 minutes" }));
    expect(screen.getByText("Sample practice focus.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Explore practice" }));
    expect(router.navigate).toHaveBeenCalledWith("/(app)/(tabs)/practice");
    expect(screen.queryByText("Sample practice focus.")).toBeNull();
  });

  it("opens notifications, clears the unread dot and allows dismissal", async () => {
    const screen = await render(content());
    await fireEvent.press(screen.getByRole("button", { name: "Notifications, unread notification" }));
    expect(screen.getByText("Your sample training focus is ready.")).toBeTruthy();
    expect(screen.queryByTestId("notification-dot")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("Your sample training focus is ready.")).toBeNull();
  });

  it("does not turn profile preferences into measured progress for unseeded players", async () => {
    const screen = await render(content({ overview: ready(empty) }));
    expect(screen.getByText("Not yet assessed")).toBeTruthy();
    expect(screen.getByText("Find your training focus")).toBeTruthy();
    expect(screen.queryByText("72%")).toBeNull();
    expect(screen.queryByText("Developing Player")).toBeNull();
    expect(screen.queryByText(/Demo data/)).toBeNull();
    expect(screen.queryByTestId("notification-dot")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("You're all caught up.")).toBeTruthy();
  });

  it("preserves independent loading and retry states without exposing diagnostics", async () => {
    const retry = jest.fn();
    const screen = await render(content({
      overview: { status: "error", error: new ApiError("SQL detail", "http", 500) },
      subscription: { status: "loading" }, onRefreshOverview: retry,
    }));
    expect(screen.getByText(/Welcome back/)).toBeTruthy();
    expect(screen.queryByText(/SQL detail/)).toBeNull();
    expect(screen.queryByText("72%")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Retry your dashboard" }));
    expect(retry).toHaveBeenCalledTimes(1);
    await screen.rerender(content({ profile: { status: "loading" }, overview: { status: "loading" } }));
    expect(screen.getByText("Loading your profile...")).toBeTruthy();
    expect(screen.getByText("Loading your stage...")).toBeTruthy();
    expect(screen.getByText("Loading your focus...")).toBeTruthy();
  });

  it("labels offline snapshots explicitly and keeps retry available", async () => {
    const screen = await render(content({
      overview: { status: "error", error: new ApiError("offline", "network"), cached: { data: demo, updatedAt: 1_798_000_000_000 } },
    }));
    expect(screen.getByText(/Showing saved details from .*These may be out of date/)).toBeTruthy();
    expect(screen.getByText("72%")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry your dashboard" })).toBeTruthy();
  });

  it.each([401, 403])("hides all dashboard data when any contract rejects access (%s)", async status => {
    const onSignOut = jest.fn();
    const screen = await render(content({
      overview: { status: "error", error: new ApiError("private diagnostic", "http", status) }, onSignOut,
      signOutError: "We couldn't sign you out. Please try again.",
    }));
    expect(screen.queryByText(/Welcome back/)).toBeNull();
    expect(screen.queryByText("72%")).toBeNull();
    await fireEvent.press(screen.getByText(status === 401 ? "Sign in again" : "Return to sign in"));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(screen.getByText("We couldn't sign you out. Please try again.")).toBeTruthy();
  });
});
