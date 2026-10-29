import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { useColorScheme } from "react-native";

import { ApiError } from "../../api/api-error";
import { useSession } from "../../session/session-context";
import { colorSchemes } from "../../theme/colors";
import type { PlayerDashboard } from "../dashboard/dashboard-api";
import { useDashboard, type DashboardSection } from "../dashboard/use-dashboard";
import { PracticeContent, PracticeScreen } from "./practice-screen";

jest.mock("expo-router", () => ({ router: { navigate: jest.fn() } }));
jest.mock("../../session/session-context", () => ({ useSession: jest.fn() }));
jest.mock("../dashboard/use-dashboard", () => ({ useDashboard: jest.fn() }));
jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({ default: jest.fn(() => "dark") }));

const demo: PlayerDashboard = {
  source: "DEVELOPMENT_SEED", progress: { percent: 72, stage: "Developing Player" },
  focus: { title: "Front Foot Drive Drill", discipline: "Batting", minutes: 15, description: "Sample practice focus." },
  notification: "Your sample training focus is ready.",
};
const empty: PlayerDashboard = { source: "NONE", progress: null, focus: null, notification: null };
const ready = (data: PlayerDashboard): DashboardSection<PlayerDashboard> => ({ status: "ready", data, updatedAt: 1 });

describe("reference practice screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useColorScheme).mockReturnValue("dark");
  });

  it("matches the reference copy, four photo tiles and recommendation", async () => {
    const screen = await render(<PracticeContent overview={ready(demo)} onRetry={jest.fn()} />);
    expect(screen.getByText("Practice")).toBeTruthy();
    expect(screen.getByText("Choose a discipline to start your session.")).toBeTruthy();
    for (const discipline of ["Batting", "Bowling", "Keeping", "Fielding"]) {
      expect(screen.getByText(discipline)).toBeTruthy();
      expect(screen.getByRole("button", { name: `Explore ${discipline.toLowerCase()}` })).toBeTruthy();
    }
    expect(screen.getByText("Recommended for you")).toBeTruthy();
    expect(screen.getByText("Back Foot Defence Drill")).toBeTruthy();
    expect(screen.getByText("Improve balance and timing")).toBeTruthy();
    expect(screen.queryByText("Demo data")).toBeNull();
    expect(screen.getByRole("image", { name: "Batter practising back foot defence" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back Foot Defence Drill, Improve balance and timing" }).props.accessibilityHint)
      .toBe("Sample drill for preview only; this is not a personal assessment.");
    expect(screen.queryByText("Coming soon")).toBeNull();
    expect(screen.queryByText("Make it personal")).toBeNull();
  });

  it("opens each discipline with honest details, dismissal and goal navigation", async () => {
    const screen = await render(<PracticeContent overview={ready(demo)} onRetry={jest.fn()} />);
    for (const discipline of ["Batting", "Bowling", "Keeping", "Fielding"]) {
      await fireEvent.press(screen.getByRole("button", { name: `Explore ${discipline.toLowerCase()}` }));
      expect(screen.getByText(`${discipline} practice`)).toBeTruthy();
      expect(screen.getByText(/Guided drills and practice logging are coming soon/)).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: "Close" }));
      expect(screen.queryByText(`${discipline} practice`)).toBeNull();
    }
    await fireEvent.press(screen.getByRole("button", { name: "Explore batting" }));
    await fireEvent.press(screen.getByRole("button", { name: "Review training goals" }));
    expect(router.navigate).toHaveBeenCalledWith("/(app)/(tabs)/profile");
    expect(screen.queryByText("Batting practice")).toBeNull();
    expect(screen.queryByText("Start practice")).toBeNull();
  });

  it("opens the sample recommendation without pretending it is a personal assessment", async () => {
    const screen = await render(<PracticeContent overview={ready(demo)} onRetry={jest.fn()} />);
    await fireEvent.press(screen.getByRole("button", { name: "Back Foot Defence Drill, Improve balance and timing" }));
    expect(screen.getByText(/This is a sample drill, not a personal assessment/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText(/This is a sample drill/)).toBeNull();
  });

  it("does not fabricate a recommendation for other accounts", async () => {
    const screen = await render(<PracticeContent overview={ready(empty)} onRetry={jest.fn()} />);
    expect(screen.queryByText("Back Foot Defence Drill")).toBeNull();
    expect(screen.queryByText("Demo data")).toBeNull();
    expect(screen.getByText(/Your recommended drills will appear here when available/)).toBeTruthy();
  });

  it("never displays the reference fixture in a production build", async () => {
    const development = __DEV__;
    Object.defineProperty(globalThis, "__DEV__", { value: false, configurable: true });
    try {
      const screen = await render(<PracticeContent overview={ready(demo)} onRetry={jest.fn()} />);
      expect(screen.queryByText("Back Foot Defence Drill")).toBeNull();
      expect(screen.queryByText("Demo data")).toBeNull();
    } finally {
      Object.defineProperty(globalThis, "__DEV__", { value: development, configurable: true });
    }
  });

  it("shows loading then a friendly retry state without displaying stale sample recommendations", async () => {
    const retry = jest.fn();
    const screen = await render(<PracticeContent overview={{ status: "loading" }} onRetry={retry} />);
    expect(screen.getByLabelText("Loading practice recommendations")).toBeTruthy();
    await screen.rerender(<PracticeContent
      overview={{ status: "error", error: new ApiError("private diagnostic", "network"), cached: { data: demo, updatedAt: 1 } }}
      onRetry={retry}
    />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText(/private diagnostic/)).toBeNull();
    expect(screen.queryByText("Back Foot Defence Drill")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Retry recommendations" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it.each(["light", "dark"] as const)("follows the device's %s theme", async (scheme) => {
    jest.mocked(useColorScheme).mockReturnValue(scheme);
    const screen = await render(<PracticeContent overview={ready(empty)} onRetry={jest.fn()} />);
    expect(screen.getByText("Practice")).toHaveStyle({ color: colorSchemes[scheme].text });
    expect(screen.getByText("Batting")).toHaveStyle({ color: "#FFFFFF" });
  });

  it.each([401, 403])("hides the entire practice screen when any self request rejects access (%s)", async (status) => {
    const signOut = jest.fn();
    jest.mocked(useSession).mockReturnValue({
      state: { status: "active", email: "asha@example.test", displayName: "Asha", hasPlayerEntitlement: true },
      signOut, signOutError: null, restoreError: null, retryRestore: jest.fn(), completeSignIn: jest.fn(),
    });
    jest.mocked(useDashboard).mockReturnValue({
      profile: { status: "loading" }, subscription: { status: "error", error: new ApiError("rejected", "http", status) },
      overview: ready(demo), refreshing: false, refresh: jest.fn(), refreshProfile: jest.fn(), refreshSubscription: jest.fn(), refreshOverview: jest.fn(),
    });
    const screen = await render(<PracticeScreen />);
    expect(screen.queryByText("Back Foot Defence Drill")).toBeNull();
    expect(screen.queryByText("Batting")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
