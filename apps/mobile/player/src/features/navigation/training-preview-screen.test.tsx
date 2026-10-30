import { fireEvent, render } from "@testing-library/react-native";

import { TrainingPreviewScreen } from "./training-preview-screen";

describe("training screen designs", () => {
  beforeEach(() => jest.clearAllMocks());

  it("switches analysis panels with explicit unavailable states and no invented score", async () => {
    const screen = await render(<TrainingPreviewScreen feature="analyze" />);
    expect(screen.getByText("Baseline first, progress reviews next")).toBeTruthy();
    expect(screen.getByText(/Player video upload, analysis and comparison are not available yet/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("tab", { name: "Pose" }));
    expect(screen.getByRole("tab", { name: "Pose", selected: true })).toBeTruthy();
    expect(screen.getByText("Understand your movement")).toBeTruthy();
    await fireEvent.press(screen.getByRole("tab", { name: "Metrics" }));
    expect(screen.getByText("Feedback you can trust")).toBeTruthy();
    expect(screen.queryByText(/78|100|Technique Score/)).toBeNull();
    expect(screen.getByRole("button", { name: "Record or upload video", disabled: true })).toBeTruthy();
  });

  it("shows the compact progress dashboard with a development-only reference preview", async () => {
    const screen = await render(<TrainingPreviewScreen feature="progress" />);
    expect(screen.getByText("Your Progress")).toBeTruthy();
    expect(screen.getByText("Track your improvement across all disciplines.")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "4 Weeks", selected: true })).toBeTruthy();
    expect(screen.getByText("Overall Progress")).toBeTruthy();
    expect(screen.getByText("+28%")).toBeTruthy();
    expect(screen.getByText("Discipline Breakdown")).toBeTruthy();
    for (const [discipline, score] of [["Batting", "76%"], ["Bowling", "68%"], ["Keeping", "62%"], ["Fielding", "70%"]]) {
      expect(screen.getByText(discipline)).toBeTruthy();
      expect(screen.getByText(score)).toBeTruthy();
    }
    expect(screen.getAllByRole("progressbar")).toHaveLength(4);
    await fireEvent.press(screen.getByRole("tab", { name: "3 Months" }));
    expect(screen.getByRole("tab", { name: "3 Months", selected: true })).toBeTruthy();
  });

  it("does not display sample progress values in a production build", async () => {
    const development = __DEV__;
    Object.defineProperty(globalThis, "__DEV__", { value: false, configurable: true });
    try {
      const screen = await render(<TrainingPreviewScreen feature="progress" />);
      expect(screen.queryByText("+28%")).toBeNull();
      for (const score of ["76%", "68%", "62%", "70%"]) {
        expect(screen.queryByText(score)).toBeNull();
      }
      expect(screen.getByText(/scores will appear after measured results are available/)).toBeTruthy();
      expect(screen.getByRole("image", { name: /Progress chart will appear/ })).toBeTruthy();
    } finally {
      Object.defineProperty(globalThis, "__DEV__", { value: development, configurable: true });
    }
  });
});
