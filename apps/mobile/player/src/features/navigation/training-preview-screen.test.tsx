import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import { TrainingPreviewScreen } from "./training-preview-screen";

jest.mock("expo-router", () => ({ router: { navigate: jest.fn() } }));

describe("training screen designs", () => {
  beforeEach(() => jest.clearAllMocks());

  it("explores four disciplines without pretending practice is released", async () => {
    const screen = await render(<TrainingPreviewScreen feature="practice" />);
    for (const discipline of ["Batting", "Bowling", "Keeping", "Fielding"]) {
      await fireEvent.press(screen.getByRole("button", { name: `Explore ${discipline.toLowerCase()}` }));
      expect(screen.getByText(`${discipline} practice`)).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Start practice", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByText("Review training goals"));
    expect(router.navigate).toHaveBeenCalledWith("/(app)/(tabs)/profile");
  });

  it("switches analysis panels with explicit unavailable states and no invented score", async () => {
    const screen = await render(<TrainingPreviewScreen feature="analyze" />);
    await fireEvent.press(screen.getByRole("tab", { name: "Pose" }));
    expect(screen.getByRole("tab", { name: "Pose", selected: true })).toBeTruthy();
    expect(screen.getByText("Understand your movement")).toBeTruthy();
    await fireEvent.press(screen.getByRole("tab", { name: "Metrics" }));
    expect(screen.getByText("Feedback you can trust")).toBeTruthy();
    expect(screen.queryByText(/78|100|Technique Score/)).toBeNull();
    expect(screen.getByRole("button", { name: "Record or upload video", disabled: true })).toBeTruthy();
  });

  it("offers roadmap, goals and certificates without fake stages, awards or trends", async () => {
    const screen = await render(<TrainingPreviewScreen feature="progress" />);
    expect(screen.getByText("Your next chapter")).toBeTruthy();
    await fireEvent.press(screen.getByRole("tab", { name: "Certificates" }));
    expect(screen.getByText("Achievements worth keeping")).toBeTruthy();
    expect(screen.getByText(/Awards will appear here when eligible/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("tab", { name: "Goals" }));
    await fireEvent.press(screen.getByText("Review my goals"));
    expect(router.navigate).toHaveBeenCalledWith("/(app)/(tabs)/profile");
    expect(screen.queryByText(/72%|Completed|Developing Player/)).toBeNull();
  });
});
