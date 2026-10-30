import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "expo-router";
import { BackHandler } from "react-native";

import { ApiError } from "../../api/api-error";
import { useSession } from "../../session/session-context";
import {
  completeRoadmapDrill, generateRoadmap, getRoadmap, saveRoadmapAnswers, roadmapDisciplines, type PlayerRoadmap,
} from "./roadmap-api";
import { RoadmapContent, RoadmapScreen } from "./roadmap-screen";

jest.mock("expo-router", () => ({
  router: { navigate: jest.fn() },
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import("react")>("react").useEffect(effect, [effect]),
}));
jest.mock("../../session/session-context", () => ({ useSession: jest.fn() }));
jest.mock("./roadmap-api", () => ({
  ...jest.requireActual("./roadmap-api"),
  completeRoadmapDrill: jest.fn(), generateRoadmap: jest.fn(), getRoadmap: jest.fn(), saveRoadmapAnswers: jest.fn(),
}));

const empty: PlayerRoadmap = {
  version: 0, profileVersion: 1, goals: ["Improve timing"], primaryDisciplines: ["BATTING"],
  answers: {}, stage: "UNASSESSED", baseline: "SELF_REPORTED",
  planKind: "PROVISIONAL_PRACTICE",
  journey: { nextStep: "VIDEO_BASELINE", videoBaseline: "UNAVAILABLE", personalRoadmap: "BLOCKED_PENDING_VERIFIED_VIDEO", progressReview: "UNAVAILABLE" },
  milestoneEligibility: "BLOCKED_PENDING_VERIFIED_VIDEO_AND_APPROVED_RUBRIC",
  policyVersion: "self-reported-evidence-v1", generating: false, needsReassessment: false,
  revisions: [], practice: [],
};
const withAnswers: PlayerRoadmap = {
  ...empty, version: 1,
  answers: Object.fromEntries(roadmapDisciplines.map(discipline => [discipline, { focus: "Consistency", confidence: 3 }])),
};
const withPath: PlayerRoadmap = {
  ...withAnswers,
  revisions: [{
    id: "revision-1", createdAt: "2026-10-29T19:00:00.000Z", inputVersion: 1, profileVersion: 1,
    snapshot: {
      model: "test-model", provider: "GEMINI", policyVersion: "self-reported-evidence-v1",
      stage: "UNASSESSED", baseline: "SELF_REPORTED",
      evidence: [{ id: "qa:BATTING", source: "SELF_REPORTED" }],
      recommendations: roadmapDisciplines.map(discipline => ({
        discipline, objective: `Improve ${discipline.toLowerCase()} consistency`, proposedStage: null,
        evidence: [`qa:${discipline}`],
        drills: discipline === "BATTING" ? [{
          id: "drill-1", title: "Balance drill", discipline, instructions: "Practise your balanced stance.",
          duration: 10, reason: "Supports your self-reported balance goal.",
        }] : [],
      })),
    },
  }],
};

async function setup(data: PlayerRoadmap, onChanged = jest.fn()) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { gcTime: Infinity } } });
  const screen = await render(<QueryClientProvider client={client}><RoadmapContent roadmap={data} onChanged={onChanged} /></QueryClientProvider>);
  return { screen, onChanged, client };
}

describe("personal roadmap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useSession).mockReturnValue({
      state: { status: "active", email: "player@example.test", hasPlayerEntitlement: true, displayName: "Player" },
      signOut: jest.fn(async () => undefined), completeSignIn: jest.fn(), retryRestore: jest.fn(),
      restoreError: null, signOutError: null,
    });
  });

  async function setupScreen(cached?: PlayerRoadmap) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
    if (cached) client.setQueryData(["player-roadmap", "player@example.test"], cached);
    const screen = await render(<QueryClientProvider client={client}><RoadmapScreen /></QueryClientProvider>);
    return { screen, client };
  }

  it("requires a video baseline without hiding existing provisional practice", async () => {
    const { screen } = await setup(withPath);
    expect(screen.getByText("Next step · Video baseline coming soon")).toBeTruthy();
    expect(screen.getByText(/Practice suggestions are provisional/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "About video baseline" }));
    expect(router.navigate).toHaveBeenLastCalledWith("/(app)/(tabs)/analyze");
    await fireEvent.press(screen.getByRole("button", { name: "View Recommended Drills" }));
    expect(screen.getByText("Balance drill")).toBeTruthy();
  });

  it("resumes an incomplete profile before the baseline step", async () => {
    const { screen } = await setup({ ...empty, journey: { ...empty.journey, nextStep: "COMPLETE_PROFILE" } });
    await fireEvent.press(screen.getByRole("button", { name: "Complete player profile" }));
    expect(router.navigate).toHaveBeenLastCalledWith("/(app)/(tabs)/profile");
    expect(screen.queryByRole("button", { name: "About video baseline" })).toBeNull();
  });

  it("opens each reference journey screen without starting video analysis or generation", async () => {
    const { screen } = await setup(withPath);
    for (const [label, heading] of [
      ["1. Quick Setup · Profile saved", "A plan that starts with you"],
      ["2. Baseline Check · Next step", "Find your starting point"],
      ["3. AI Builds Your Plan", "Your next two weeks"],
      ["4. Weekly Self-Coaching Loop", "A simple loop. Real commitment."],
      ["5. Stage Progression", "Stage progression"],
    ]) {
      await fireEvent.press(screen.getByRole("button", { name: label }));
      expect(screen.getByRole("header", { name: heading })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "1. Quick Setup · Profile saved" })).toBeNull();
      await fireEvent.press(screen.getByRole("button", { name: "Back to roadmap" }));
    }
    expect(generateRoadmap).not.toHaveBeenCalled();
    expect(completeRoadmapDrill).not.toHaveBeenCalled();
  });

  it("keeps the two-week plan as a preview and exposes only actual provisional practice", async () => {
    const { screen } = await setup(withPath);
    await fireEvent.press(screen.getByRole("button", { name: "3. AI Builds Your Plan" }));
    expect(screen.getByText("PERSONAL PLAN · AWAITING VIDEO BASELINE")).toBeTruthy();
    for (const title of ["Primary focus", "Secondary focus", "2-week goals", "Recommended drills", "Success metric"]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    expect(screen.getByText(/No video-based plan or review date has been set yet/)).toBeTruthy();
    expect(screen.getByText("AVAILABLE NOW · PROVISIONAL PRACTICE")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "View Recommended Drills" }));
    expect(screen.getByRole("header", { name: "Your Drills" })).toBeTruthy();
    expect(screen.getByText("Balance drill")).toBeTruthy();
  });

  it("uses the supplied baseline artwork without offering a fake playable analysis", async () => {
    const { screen } = await setup(withPath);
    await fireEvent.press(screen.getByRole("button", { name: "2. Baseline Check · Next step" }));
    expect(screen.getByLabelText("Example cricket video setup, not your personal analysis")).toBeTruthy();
    expect(screen.getByText("VIDEO BASELINE · COMING SOON")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Play|Upload|Record video/ })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Answer practice questions" }));
    expect(screen.getByRole("tab", { name: "Goals", selected: true })).toBeTruthy();
    expect(generateRoadmap).not.toHaveBeenCalled();
  });

  it("returns to the latest suggestions from the overview after viewing earlier practice", async () => {
    const newest = {
      ...withPath.revisions[0], id: "latest",
      snapshot: { ...withPath.revisions[0].snapshot, recommendations: withPath.revisions[0].snapshot.recommendations.map(row => ({
        ...row, drills: row.drills.map(drill => ({ ...drill, id: "new-drill", title: "Latest balance drill" })),
      })) },
    };
    const { screen } = await setup({ ...withPath, revisions: [newest, withPath.revisions[0]] });
    await fireEvent.press(screen.getByRole("tab", { name: "Goals" }));
    await fireEvent.press(screen.getByRole("button", { name: "View history" }));
    await fireEvent.press(screen.getByRole("button", { name: /Previous path/ }));
    expect(screen.getByText("Balance drill")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Back to roadmap" }));
    await fireEvent.press(screen.getByRole("button", { name: "View Recommended Drills" }));
    expect(screen.getByText("Latest balance drill")).toBeTruthy();
    expect(screen.queryByText("Balance drill")).toBeNull();
  });

  it("takes Android Back to the overview from a journey detail", async () => {
    let onBack: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    const listener = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_, handler) => {
      onBack = handler;
      return { remove: jest.fn() };
    });
    try {
      const { screen } = await setup(withPath);
      await fireEvent.press(screen.getByRole("button", { name: "4. Weekly Self-Coaching Loop" }));
      expect(screen.getByLabelText("Practice, then record, then review, then adjust. Repeat the self-coaching loop.")).toBeTruthy();
      expect(onBack).toBeDefined();
      await act(async () => { expect(onBack?.({ type: "hardwareBackPress", timeStamp: Date.now() })).toBe(true); });
      expect(screen.getByRole("header", { name: "Your Plan" })).toBeTruthy();
      expect(router.navigate).not.toHaveBeenCalled();
    } finally {
      listener.mockRestore();
    }
  });

  it("shows loading without a sample path", async () => {
    jest.mocked(getRoadmap).mockImplementation(() => new Promise(() => undefined));
    const { screen } = await setupScreen();
    expect(screen.getByLabelText("Loading your roadmap")).toBeTruthy();
    expect(screen.queryByText("Your Plan")).toBeNull();
  });

  it("retries a failed load without exposing diagnostics or showing mock progress", async () => {
    jest.mocked(getRoadmap).mockRejectedValueOnce(new ApiError("private diagnostic", "network")).mockResolvedValue(empty);
    const { screen } = await setupScreen();
    await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy());
    expect(screen.queryByText("private diagnostic")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByText("Your Plan")).toBeTruthy());
  });

  it.each([401, 403])("hides cached private paths when access is rejected with %i", async status => {
    jest.mocked(getRoadmap).mockRejectedValue(new ApiError("private diagnostic", "http", status));
    const { screen } = await setupScreen(withPath);
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy());
    expect(screen.queryByText("Balance drill")).toBeNull();
    expect(screen.queryByText("Your Plan")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(jest.mocked(useSession).mock.results[0].value.signOut).toHaveBeenCalled();
  });

  it("also hides a loaded path when a write discovers expired access", async () => {
    jest.mocked(getRoadmap).mockResolvedValue(withPath);
    jest.mocked(generateRoadmap).mockRejectedValue(new ApiError("expired", "http", 401));
    const { screen } = await setupScreen();
    await waitFor(() => expect(screen.getByRole("button", { name: "View Recommended Drills" })).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Refresh practice suggestions" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy());
    expect(screen.queryByText("Balance drill")).toBeNull();
  });

  it("does not invent a baseline, score, stage or certificate and validates all four answers", async () => {
    const { screen } = await setup(empty);
    expect(screen.queryByText("76%")).toBeNull();
    expect(screen.queryByRole("button", { name: "Prepare practice suggestions" })).toBeNull();
    await fireEvent.press(screen.getByRole("tab", { name: "Certificates" }));
    expect(screen.getByText("Current stage: Not yet assessed")).toBeTruthy();
    await fireEvent.press(screen.getByRole("tab", { name: "Goals" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save check-in" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(saveRoadmapAnswers).not.toHaveBeenCalled();
  });

  it("persists four-discipline Q&A through the typed client", async () => {
    jest.mocked(saveRoadmapAnswers).mockResolvedValue(withAnswers);
    const { screen, onChanged } = await setup(empty);
    await fireEvent.press(screen.getByRole("tab", { name: "Goals" }));
    for (const label of ["Batting", "Bowling", "Keeping", "Fielding"]) {
      await fireEvent.press(screen.getByRole("tab", { name: label }));
      await fireEvent.changeText(screen.getByLabelText(`${label} improvement focus`), "Consistency");
    }
    await fireEvent.press(screen.getByRole("tab", { name: "Batting" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Batting confidence 4" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save check-in" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(withAnswers));
    expect(saveRoadmapAnswers).toHaveBeenCalledWith(0, expect.objectContaining({ BATTING: { confidence: 4, focus: "Consistency" } }));
  });

  it("generates a real path and reuses the request id when a request fails", async () => {
    jest.mocked(generateRoadmap).mockRejectedValue(new ApiError("private diagnostic", "network"));
    const { screen } = await setup(withAnswers);
    await fireEvent.press(screen.getByRole("button", { name: "Prepare practice suggestions" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Prepare practice suggestions" }));
    await waitFor(() => expect(generateRoadmap).toHaveBeenCalledTimes(2));
    expect(jest.mocked(generateRoadmap).mock.calls[0]).toEqual(jest.mocked(generateRoadmap).mock.calls[1]);
    expect(screen.queryByText("private diagnostic")).toBeNull();
  });

  it("shows recommendations and drill instructions, then records self-reported evidence", async () => {
    jest.mocked(completeRoadmapDrill).mockResolvedValue({ ...withPath, version: 2 });
    const { screen, onChanged } = await setup(withPath);
    await fireEvent.press(screen.getByRole("button", { name: "View Recommended Drills" }));
    for (const discipline of ["Batting", "Bowling", "Keeping", "Fielding"]) {
      expect(screen.getByRole("tab", { name: discipline })).toBeTruthy();
    }
    await fireEvent.press(screen.getByRole("button", { name: "View drill" }));
    expect(screen.getByText("Practise your balanced stance.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Log practice" }));
    await fireEvent.changeText(screen.getByLabelText("Balance drill reflection"), "Worked on a balanced stance");
    await fireEvent.press(screen.getByRole("button", { name: "Record completion" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(completeRoadmapDrill).toHaveBeenCalledWith(expect.objectContaining({
      revisionId: "revision-1", drillId: "drill-1", minutes: 10, reflection: "Worked on a balanced stance",
    }));
  });

  it("keeps completed evidence visible and blocks duplicate completion in the UI", async () => {
    const { screen } = await setup({
      ...withPath, needsReassessment: true, practice: [{
        id: "p1", revisionId: "revision-1", drillId: "drill-1", discipline: "BATTING",
        minutes: 10, reflection: "Worked on balance", completedAt: "2026-10-29T19:05:00.000Z", source: "SELF_REPORTED",
      }],
    });

    expect(screen.getByText(/Your goals or practice evidence have changed/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "View Recommended Drills" }));
    await fireEvent.press(screen.getByRole("button", { name: "View drill" }));
    expect(screen.getByText("Completed · Self-reported")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Record completion" })).toBeNull();
    await fireEvent.press(screen.getByRole("tab", { name: "Goals" }));
    await fireEvent.press(screen.getByRole("button", { name: "View history" }));
    expect(screen.getByText("Worked on balance")).toBeTruthy();
  });

  it("keeps earlier paths view-only and disables generation while another request is running", async () => {
    const { screen } = await setup({
      ...withPath, generating: true, revisions: [
        { ...withPath.revisions[0], id: "revision-2" },
        { ...withPath.revisions[0], createdAt: "2026-10-28T19:00:00.000Z" },
      ],
    });
    expect(screen.getByRole("button", { name: "Preparing practice...", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("tab", { name: "Goals" }));
    await fireEvent.press(screen.getByRole("button", { name: "View history" }));
    await fireEvent.press(screen.getByRole("button", { name: /Previous path/ }));
    await fireEvent.press(screen.getByRole("button", { name: "View drill" }));
    expect(screen.getByText("Previous path · View only")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Record completion" })).toBeNull();
  });

  it("uses a fresh request after a profile change instead of replaying the previous path", async () => {
    jest.mocked(generateRoadmap).mockRejectedValue(new ApiError("network", "network"));
    const { screen, client, onChanged } = await setup(withAnswers);
    await fireEvent.press(screen.getByRole("button", { name: "Prepare practice suggestions" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    await screen.rerender(<QueryClientProvider client={client}><RoadmapContent roadmap={{ ...withAnswers, profileVersion: 2 }} onChanged={onChanged} /></QueryClientProvider>);
    await fireEvent.press(screen.getByRole("button", { name: "Prepare practice suggestions" }));
    await waitFor(() => expect(generateRoadmap).toHaveBeenCalledTimes(2));
    expect(jest.mocked(generateRoadmap).mock.calls[0][1]).not.toBe(jest.mocked(generateRoadmap).mock.calls[1][1]);
  });

  it("opens existing profile and goal editing rather than storing separate goals", async () => {
    const { screen } = await setup(empty);
    await fireEvent.press(screen.getByRole("tab", { name: "Goals" }));
    await fireEvent.press(screen.getByRole("button", { name: "Review profile and goals" }));
    expect(router.navigate).toHaveBeenCalledWith("/(app)/(tabs)/profile");
  });

  it("shows only the selected discipline and separates history and check-in from the training path", async () => {
    const { screen } = await setup(withPath);
    expect(screen.getByRole("tab", { name: "Roadmap", selected: true })).toBeTruthy();
    expect(screen.queryByText("Improve batting consistency")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "View Recommended Drills" }));
    expect(screen.getByText("Improve batting consistency")).toBeTruthy();
    expect(screen.queryByText("Improve bowling consistency")).toBeNull();
    expect(screen.queryByText("Your goals")).toBeNull();
    expect(screen.queryByText("Path history")).toBeNull();
    await fireEvent.press(screen.getByRole("tab", { name: "Bowling" }));
    expect(screen.getByText("Improve bowling consistency")).toBeTruthy();
    expect(screen.queryByText("Balance drill")).toBeNull();
    await fireEvent.press(screen.getByRole("tab", { name: "Goals" }));
    await fireEvent.press(screen.getByRole("button", { name: "View history" }));
    expect(screen.getByText("Path history")).toBeTruthy();
    expect(screen.queryByText("Improve bowling consistency")).toBeNull();
    await fireEvent.press(screen.getByRole("tab", { name: "Roadmap" }));
    expect(screen.getByRole("tab", { name: "Bowling", selected: true })).toBeTruthy();
  });

  it("retains check-in and practice drafts when switching tabs without making a save request", async () => {
    const { screen } = await setup(withPath);
    await fireEvent.press(screen.getByRole("button", { name: "View Recommended Drills" }));
    await fireEvent.press(screen.getByRole("button", { name: "Log practice" }));
    await fireEvent.changeText(screen.getByLabelText("Balance drill reflection"), "My unsaved reflection");
    await fireEvent.press(screen.getByRole("tab", { name: "Bowling" }));
    await fireEvent.press(screen.getByRole("tab", { name: "Goals" }));
    await fireEvent.changeText(screen.getByLabelText("Batting improvement focus"), "My unsaved focus");
    await fireEvent.press(screen.getByRole("tab", { name: "Certificates" }));
    await fireEvent.press(screen.getByRole("tab", { name: "Goals" }));
    expect(screen.getByDisplayValue("My unsaved focus")).toBeTruthy();
    await fireEvent.press(screen.getByRole("tab", { name: "Roadmap" }));
    await fireEvent.press(screen.getByRole("tab", { name: "Batting" }));
    expect(screen.getByDisplayValue("My unsaved reflection")).toBeTruthy();
    expect(saveRoadmapAnswers).not.toHaveBeenCalled();
    expect(completeRoadmapDrill).not.toHaveBeenCalled();
  });

  it("formats drill instructions as bold labelled sections without removing safety information", async () => {
    const data = {
      ...withPath, revisions: [{
        ...withPath.revisions[0], snapshot: {
          ...withPath.revisions[0].snapshot,
          recommendations: withPath.revisions[0].snapshot.recommendations.map(row => ({
            ...row, drills: row.drills.map(drill => ({
              ...drill, instructions: "Equipment: Soft ball.\nSetup: Clear a safe space.\nSteps: Practise slowly.\nCues: Stay balanced.\nSafety: Stop if anything hurts.",
            })),
          })),
        },
      }],
    };
    const { screen } = await setup(data);
    expect(screen.queryByText("Stop if anything hurts.")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "View Recommended Drills" }));
    await fireEvent.press(screen.getByRole("button", { name: "View drill" }));
    for (const label of ["Equipment", "Setup", "Steps", "Cues", "Safety"]) {
      expect(screen.getByRole("header", { name: label })).toBeTruthy();
    }
    expect(screen.getByText("Stop if anything hurts.")).toBeTruthy();
    expect(screen.queryByLabelText("Balance drill reflection")).toBeNull();
    expect(screen.getByText("Safety")).toHaveStyle({ fontWeight: "700" });
    expect(screen.getByRole("header", { name: "Balance drill" })).toHaveStyle({ fontWeight: "700", fontSize: 19 });
  });

  it("keeps the assessment explanation available without repeating it on every discipline", async () => {
    const { screen } = await setup(withPath);
    expect(screen.queryByText(/Completing drills alone/)).toBeNull();
    await fireEvent.press(screen.getByRole("tab", { name: "Certificates" }));
    await fireEvent.press(screen.getByRole("button", { name: "About your assessed stage" }));
    expect(screen.getByText(/Completing drills alone will not advance your stage/)).toBeTruthy();
  });

  it("keeps history bounded and reveals older practice and paths only on request", async () => {
    const { screen } = await setup({
      ...withPath,
      revisions: Array.from({ length: 6 }, (_, index) => ({
        ...withPath.revisions[0], id: `revision-${index}`, createdAt: `2026-10-${29 - index}T19:00:00.000Z`,
      })),
      practice: Array.from({ length: 6 }, (_, index) => ({
        id: `practice-${index}`, revisionId: "revision-0", drillId: `drill-${index}`, discipline: "BATTING" as const,
        minutes: 10, reflection: `Practice reflection ${index}`, completedAt: "2026-10-29T19:00:00.000Z", source: "SELF_REPORTED" as const,
      })),
    });
    await fireEvent.press(screen.getByRole("tab", { name: "Goals" }));
    await fireEvent.press(screen.getByRole("button", { name: "View history" }));
    expect(screen.getAllByRole("button", { name: /Previous path/ })).toHaveLength(4);
    expect(screen.getByText("Practice reflection 4")).toBeTruthy();
    expect(screen.queryByText("Practice reflection 5")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Show more paths" }));
    expect(screen.getAllByRole("button", { name: /Previous path/ })).toHaveLength(5);
    await fireEvent.press(screen.getByRole("button", { name: "Show more practice" }));
    expect(screen.getByText("Practice reflection 5")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show more practice" })).toBeNull();
  });

  it("uses the reference timeline without fabricating skill stages or completion percentages", async () => {
    const { screen } = await setup(withPath);
    expect(screen.getByRole("header", { name: "Your Plan" })).toBeTruthy();
    expect(screen.getByText("Simple AI-guided self-coaching, built around you.")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Roadmap", selected: true })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Goals" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Certificates" })).toBeTruthy();
    for (const title of ["Quick Setup", "Baseline Check", "AI Builds Your Plan", "Weekly Self-Coaching Loop", "Stage Progression"]) {
      expect(screen.getByRole("button", { name: new RegExp(title) })).toBeTruthy();
    }
    expect(screen.queryByText(/70%/)).toBeNull();
    expect(screen.queryByText("Balance drill")).toBeNull();
    expect(screen.queryByText("Improve batting consistency")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "5. Stage Progression" }));
    expect(screen.getByText("Foundation")).toBeTruthy();
    expect(screen.getByText("Consistency")).toBeTruthy();
    expect(screen.getByText("Execution")).toBeTruthy();
    expect(screen.getByText("Match Ready")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "View certificate eligibility" }));
    expect(screen.getByText("Locked · Not yet assessed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Download|Share certificate/ })).toBeNull();
  });

  it("derives timeline progress only from completed drills on the viewed revision", async () => {
    const data: PlayerRoadmap = {
      ...withPath,
      revisions: [{
        ...withPath.revisions[0], snapshot: {
          ...withPath.revisions[0].snapshot,
          recommendations: withPath.revisions[0].snapshot.recommendations.map(row => ({
            ...row, drills: row.discipline === "BATTING" ? [row.drills[0], { ...row.drills[0], id: "drill-2" }] : row.drills,
          })),
        },
      }],
      practice: [{
        id: "p1", revisionId: "revision-1", drillId: "drill-1", discipline: "BATTING",
        minutes: 10, reflection: "Balance", completedAt: "2026-10-29T19:00:00.000Z", source: "SELF_REPORTED",
      }],
    };
    const { screen, client, onChanged } = await setup(data);
    await fireEvent.press(screen.getByRole("button", { name: "View Recommended Drills" }));
    expect(screen.getByText("1 of 2 drills logged · 50%")).toBeTruthy();
    await screen.rerender(<QueryClientProvider client={client}><RoadmapContent roadmap={{
      ...data, practice: [...data.practice, { ...data.practice[0], id: "p2", drillId: "drill-2" }],
    }} onChanged={onChanged} /></QueryClientProvider>);
    expect(screen.getByText("2 of 2 drills logged · 100%")).toBeTruthy();
    expect(screen.queryByText(/50%/)).toBeNull();
    await fireEvent.press(screen.getByRole("tab", { name: "Certificates" }));
    expect(screen.getByText("Locked · Not yet assessed")).toBeTruthy();
  });

  it("opens the selected timeline discipline and returns to the compact overview", async () => {
    const { screen } = await setup(withPath);
    await fireEvent.press(screen.getByRole("button", { name: "View Recommended Drills" }));
    await fireEvent.press(screen.getByRole("tab", { name: "Bowling" }));
    expect(screen.getByRole("header", { name: "Your Drills" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Bowling", selected: true })).toBeTruthy();
    expect(screen.getByText("Improve bowling consistency")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Back to roadmap" }));
    expect(screen.getByRole("header", { name: "Your Plan" })).toBeTruthy();
    expect(screen.queryByRole("header", { name: "YOUR BOWLING FOCUS" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Back to home" }));
    expect(router.navigate).toHaveBeenCalledWith("/(app)/(tabs)/home");
  });
});
