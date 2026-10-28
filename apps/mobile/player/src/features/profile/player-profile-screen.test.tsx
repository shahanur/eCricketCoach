import { fireEvent, render } from "@testing-library/react-native";

import { ProfileEditor } from "./player-profile-screen";
import type { PlayerProfile, PlayerProfileUpdate } from "./player-profile-api";

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
