import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "expo-router";
import { useColorScheme } from "react-native";

import { ApiError } from "../../api/api-error";
import { useSession } from "../../session/session-context";
import { colorSchemes } from "../../theme/colors";
import { getPlayerDashboard, type PlayerDashboard } from "../dashboard/dashboard-api";
import { useSubscription } from "../subscription/use-subscription";
import { getPlayerProfile, type PlayerProfile } from "./player-profile-api";
import { PlayerProfileScreen } from "./player-profile-screen";
import { ProfileOverview } from "./profile-overview";

jest.mock("expo-router", () => ({
  router: { navigate: jest.fn() },
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import("react")>("react").useEffect(effect, [effect]),
}));
jest.mock("../../session/session-context", () => ({ useSession: jest.fn() }));
jest.mock("../subscription/use-subscription", () => ({ useSubscription: jest.fn() }));
jest.mock("../dashboard/dashboard-api", () => ({ getPlayerDashboard: jest.fn() }));
jest.mock("./player-profile-api", () => ({ getPlayerProfile: jest.fn(), updatePlayerProfile: jest.fn() }));
jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({ default: jest.fn(() => "dark") }));

const profile: PlayerProfile = {
  id: "profile-1", displayName: "Alex Carter", primaryDisciplines: ["BATTING"],
  battingHandedness: "RIGHT", bowlingStyle: "NOT_SET", experienceLevel: "DEVELOPING",
  goals: [], isComplete: true, version: 1,
  createdAt: "2026-10-28T12:00:00.000Z", updatedAt: "2026-10-28T12:00:00.000Z",
};
const demo: PlayerDashboard = {
  source: "DEVELOPMENT_SEED", progress: { percent: 72, stage: "Developing Player" },
  focus: { title: "Drive", discipline: "Batting", minutes: 15, description: "Sample practice focus." },
  notification: "Your sample training focus is ready.",
};
const empty: PlayerDashboard = { source: "NONE", progress: null, focus: null, notification: null };
const ready = (data: PlayerDashboard) => ({ status: "ready" as const, data, updatedAt: 1 });

describe("reference player profile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useColorScheme).mockReturnValue("dark");
  });

  it("renders the reference hierarchy and four stats in two rows", async () => {
    const screen = await render(<ProfileOverview profile={profile} overview={ready(demo)} onEdit={jest.fn()} onRetry={jest.fn()} />);
    for (const text of ["Your Player Profile", "Alex Carter", "Individual Player", "Current Stage", "Developing Player", "Quick Stats", "22", "78", "12", "3"]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    for (const label of ["Videos Analyzed", "Avg Technique Score", "Drills Completed", "Certificates"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Edit Profile" })).toHaveStyle({ minHeight: 44 });
  });

  it("wires settings, current stage, and both edit actions", async () => {
    const edit = jest.fn();
    const screen = await render(<ProfileOverview profile={profile} overview={ready(demo)} onEdit={edit} onRetry={jest.fn()} />);
    await fireEvent.press(screen.getByRole("button", { name: "Open settings" }));
    expect(router.navigate).toHaveBeenCalledWith("/(app)/settings");
    await fireEvent.press(screen.getByRole("button", { name: /Current Stage/ }));
    expect(router.navigate).toHaveBeenCalledWith("/(app)/(tabs)/progress");
    await fireEvent.press(screen.getByRole("button", { name: "Edit Profile" }));
    await fireEvent.press(screen.getByRole("button", { name: "Edit player details" }));
    expect(edit).toHaveBeenCalledTimes(2);
  });

  it("uses the actual player name and does not infer a skill stage from their experience", async () => {
    const screen = await render(<ProfileOverview profile={{ ...profile, displayName: "Asha Player" }} overview={ready(empty)} onEdit={jest.fn()} onRetry={jest.fn()} />);
    expect(screen.getByText("Asha Player")).toBeTruthy();
    expect(screen.queryByText("Alex Carter")).toBeNull();
    expect(screen.getByText("Not yet assessed")).toBeTruthy();
    expect(screen.queryByText("Developing Player")).toBeNull();
    expect(screen.getAllByText("\u2014")).toHaveLength(4);
  });

  it("never exposes reference scores or a reference portrait in a release build", async () => {
    const development = __DEV__;
    Object.defineProperty(globalThis, "__DEV__", { value: false, configurable: true });
    try {
      const screen = await render(<ProfileOverview profile={profile} overview={ready(demo)} onEdit={jest.fn()} onRetry={jest.fn()} />);
      for (const value of ["22", "78", "12", "3", "Developing Player"]) expect(screen.queryByText(value)).toBeNull();
      expect(screen.queryByLabelText("Cricket player profile illustration")).toBeNull();
    } finally {
      Object.defineProperty(globalThis, "__DEV__", { value: development, configurable: true });
    }
  });

  it("shows loading and friendly retry states without manufacturing stats", async () => {
    const retry = jest.fn();
    const screen = await render(<ProfileOverview profile={profile} overview={{ status: "loading" }} onEdit={jest.fn()} onRetry={retry} />);
    expect(screen.getByText("Loading your stats...")).toBeTruthy();
    await screen.rerender(<ProfileOverview profile={profile} overview={{ status: "error", error: new ApiError("private diagnostic", "network") }} onEdit={jest.fn()} onRetry={retry} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("private diagnostic")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Retry stats" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it.each(["light", "dark"] as const)("preserves the %s theme", async (scheme) => {
    jest.mocked(useColorScheme).mockReturnValue(scheme);
    const screen = await render(<ProfileOverview profile={profile} overview={ready(empty)} onEdit={jest.fn()} onRetry={jest.fn()} />);
    expect(screen.getByText("Your Player Profile")).toHaveStyle({ color: colorSchemes[scheme].text });
  });

  it("opens the existing editable form from the profile overview", async () => {
    jest.mocked(useSession).mockReturnValue({
      state: { status: "active", email: "alex@example.test", displayName: profile.displayName, hasPlayerEntitlement: true },
      signOut: jest.fn(), signOutError: null, restoreError: null, retryRestore: jest.fn(), completeSignIn: jest.fn(),
    });
    jest.mocked(useSubscription).mockReturnValue({ state: { status: "loading" }, retry: jest.fn() });
    jest.mocked(getPlayerProfile).mockResolvedValue(profile);
    jest.mocked(getPlayerDashboard).mockResolvedValue(demo);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const screen = await render(<QueryClientProvider client={client}><PlayerProfileScreen /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText("Alex Carter")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Edit Profile" }));
    expect(screen.getByLabelText("Player name")).toHaveDisplayValue("Alex Carter");
    expect(screen.getByRole("button", { name: "Back to profile" })).toBeTruthy();
    expect(screen.queryByText("Subscription details")).toBeNull();
    expect(screen.queryByText("Your Individual Player plan")).toBeNull();
    client.clear();
  });

  it.each([401, 403])("hides profile stats when access is rejected (%s)", async (status) => {
    const signOut = jest.fn();
    jest.mocked(useSession).mockReturnValue({
      state: { status: "active", email: "alex@example.test", displayName: profile.displayName, hasPlayerEntitlement: true },
      signOut, signOutError: null, restoreError: null, retryRestore: jest.fn(), completeSignIn: jest.fn(),
    });
    jest.mocked(useSubscription).mockReturnValue({ state: { status: "loading" }, retry: jest.fn() });
    jest.mocked(getPlayerProfile).mockResolvedValue(profile);
    jest.mocked(getPlayerDashboard).mockRejectedValue(new ApiError("rejected", "http", status));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const screen = await render(<QueryClientProvider client={client}><PlayerProfileScreen /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy());
    expect(screen.queryByText("Quick Stats")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
    client.clear();
  });
});
