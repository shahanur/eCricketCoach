import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert, BackHandler } from "react-native";

import { ProfileEditor } from "./player-profile-screen";
import type { PlayerProfile, PlayerProfileUpdate } from "./player-profile-api";

jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import("react")>("react").useEffect(effect, [effect]),
}));

const profile: PlayerProfile = {
  id: "profile-1",
  displayName: "Asha Player",
  battingHandedness: "NOT_SET",
  bowlingStyle: "NOT_SET",
  primaryDisciplines: [],
  experienceLevel: "NOT_SET",
  goals: [],
  isComplete: false,
  version: 0,
  createdAt: "2026-10-28T12:00:00.000Z",
  updatedAt: "2026-10-28T12:00:00.000Z",
};

describe("player profile editor", () => {
  it("uses the same automatic save for Android hardware Back", async () => {
    const listener = jest.spyOn(BackHandler, "addEventListener");
    const onSave = jest.fn(async () => undefined);
    const onClose = jest.fn();
    const screen = await render(
      <ProfileEditor profile={profile} email="asha@example.test" onSave={onSave} onClose={onClose} onRefresh={jest.fn()} onEdit={jest.fn()} isSaving={false} saveError={null} saveConflict={false} />,
    );
    await fireEvent.changeText(screen.getByLabelText("Player name"), "Asha Khan");
    const handler = listener.mock.calls[listener.mock.calls.length - 1][1];
    await act(async () => { expect(handler({ type: "hardwareBackPress", timeStamp: Date.now() })).toBe(true); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ displayName: "Asha Khan" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    listener.mockRestore();
  });

  it("automatically saves before closing without showing a confirmation", async () => {
    const onSave = jest.fn(async () => undefined);
    const onClose = jest.fn();
    const alert = jest.spyOn(Alert, "alert");
    const screen = await render(
      <ProfileEditor profile={profile} email="asha@example.test" onSave={onSave} onClose={onClose} onRefresh={jest.fn()} onEdit={jest.fn()} isSaving={false} saveError={null} saveConflict={false} />,
    );
    await fireEvent.changeText(screen.getByLabelText("Player name"), "Asha Khan");
    await fireEvent.press(screen.getByRole("button", { name: "Back to profile" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ displayName: "Asha Khan" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it("returns immediately without saving an unchanged profile", async () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <ProfileEditor profile={profile} email="asha@example.test" onSave={onSave} onClose={onClose} onRefresh={jest.fn()} onEdit={jest.fn()} isSaving={false} saveError={null} saveConflict={false} />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Back to profile" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps the editor open for invalid input or a failed automatic save", async () => {
    const onSave = jest.fn(async () => { throw new Error("private diagnostic"); });
    const onClose = jest.fn();
    const screen = await render(
      <ProfileEditor profile={profile} email="asha@example.test" onSave={onSave} onClose={onClose} onRefresh={jest.fn()} onEdit={jest.fn()} isSaving={false} saveError={null} saveConflict={false} />,
    );
    await fireEvent.changeText(screen.getByLabelText("Player name"), " ");
    await fireEvent.press(screen.getByRole("button", { name: "Back to profile" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText("Player name"), "Asha Khan");
    await fireEvent.press(screen.getByRole("button", { name: "Back to profile" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("private diagnostic")).toBeNull();
  });

  it("groups player details, playing preferences and goals into focused sections", async () => {
    const screen = await render(
      <ProfileEditor profile={profile} email="asha@example.test" onSave={jest.fn()} onRefresh={jest.fn()} onEdit={jest.fn()} isSaving={false} saveError={null} saveConflict={false} />,
    );
    for (const title of ["Player details", "Your game", "Training goals"]) {
      expect(screen.getByRole("header", { name: title })).toBeTruthy();
    }
    expect(screen.getByLabelText("Account email: asha@example.test")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save progress", disabled: true })).toBeTruthy();
    expect(screen.queryByText("Your cricket profile")).toBeNull();
  });

  it("resumes an incomplete profile and saves validated player details", async () => {
    const onSave = jest.fn(async (_update: PlayerProfileUpdate) => undefined);
    const screen = await render(
      <ProfileEditor profile={profile} email="asha@example.test" onSave={onSave} onRefresh={jest.fn()} onEdit={jest.fn()} isSaving={false} saveError={null} saveConflict={false} />,
    );
    expect(screen.getByText("Choose at least one discipline to complete your profile.")).toBeTruthy();
    expect(screen.getByText("Save progress")).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText("Your name"), "Asha Khan");
    await fireEvent.press(screen.getAllByRole("checkbox")[0]);
    await fireEvent.changeText(screen.getByPlaceholderText("For example:\nImprove my front-foot drive"), "Improve footwork");
    await fireEvent.press(screen.getByText("Save profile"));

    expect(onSave).toHaveBeenCalledWith({
      version: 0,
      displayName: "Asha Khan",
      battingHandedness: "NOT_SET",
      bowlingStyle: "NOT_SET",
      primaryDisciplines: ["BATTING"],
      experienceLevel: "NOT_SET",
      goals: ["Improve footwork"],
    });
  });

  it("shows unsaved changes and validates the player name", async () => {
    const screen = await render(
      <ProfileEditor profile={profile} email="asha@example.test" onSave={jest.fn()} onRefresh={jest.fn()} onEdit={jest.fn()} isSaving={false} saveError={null} saveConflict={false} />,
    );
    await fireEvent.changeText(screen.getByPlaceholderText("Your name"), " ");
    expect(screen.getByText("You have unsaved changes.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Save progress"));
    expect(screen.getByText("Enter a player name of up to 80 characters.")).toBeTruthy();
  });

  it("shows save failures without exposing diagnostic text", async () => {
    const screen = await render(
      <ProfileEditor
        profile={{ ...profile, primaryDisciplines: ["BATTING"], isComplete: true }}
        email="asha@example.test"
        onSave={jest.fn()}
        onRefresh={jest.fn()}
        onEdit={jest.fn()}
        isSaving={false}
        saveError="Your profile changed on another device. Refresh it before saving again."
        saveConflict
      />,
    );
    expect(screen.getByText("Your profile changed on another device. Refresh it before saving again.")).toBeTruthy();
    expect(screen.queryByText(/API|token|server/i)).toBeNull();
  });
});
