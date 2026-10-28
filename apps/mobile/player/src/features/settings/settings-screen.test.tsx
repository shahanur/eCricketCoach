import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import { useSession } from "../../session/session-context";
import { SettingsScreen } from "./settings-screen";

jest.mock("expo-router", () => ({ router: { navigate: jest.fn() } }));
jest.mock("../../session/session-context", () => ({ useSession: jest.fn() }));
jest.mock("../web-app/open-web-app-button", () => ({ OpenWebAppButton: () => null }));

describe("player settings", () => {
  it("connects real account actions and keeps unreleased integrations honest", async () => {
    const signOut = jest.fn();
    jest.mocked(useSession).mockReturnValue({
      state: { status: "active", hasPlayerEntitlement: true, email: "asha@example.test", displayName: "Asha" },
      signOut, signOutError: null, restoreError: null, retryRestore: jest.fn(), completeSignIn: jest.fn(),
    });
    const screen = await render(<SettingsScreen />);
    expect(screen.getByText("asha@example.test")).toBeTruthy();
    expect(screen.getByText(/System theme:/)).toBeTruthy();
    expect(screen.getByText(/Google Drive sync, notification preferences and biometric unlock are not available/)).toBeTruthy();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    await fireEvent.press(screen.getByText("Personal information"));
    expect(router.navigate).toHaveBeenLastCalledWith("/(app)/(tabs)/profile");
    await fireEvent.press(screen.getByText("Manage subscription"));
    expect(router.navigate).toHaveBeenLastCalledWith("/(app)/subscription");
    await fireEvent.press(screen.getByText("Sign out"));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
