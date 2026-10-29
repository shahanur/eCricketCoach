import { ApiError } from "../../api/api-error";
import { requestJson } from "../../api/api-client";
import { secureSessionStorage } from "../../session/secure-session-storage";
import { completeRoadmapDrill, generateRoadmap, getRoadmap, roadmapSchema } from "./roadmap-api";

jest.mock("../../api/api-client", () => ({ requestJson: jest.fn() }));
jest.mock("../../session/secure-session-storage", () => ({ secureSessionStorage: { getAccessToken: jest.fn() } }));

describe("owner-scoped roadmap client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(secureSessionStorage.getAccessToken).mockResolvedValue("test-session");
    jest.mocked(requestJson).mockResolvedValue({ roadmap: {} });
  });
  it("uses the central authenticated client without a player or tenant ID", async () => {
    await getRoadmap();
    expect(requestJson).toHaveBeenLastCalledWith(expect.objectContaining({ path: "/api/player/roadmap", accessToken: "test-session", method: "GET" }));
    await generateRoadmap(3, "retry-key");
    expect(requestJson).toHaveBeenLastCalledWith(expect.objectContaining({ path: "/api/player/roadmap/generate", body: { version: 3, requestId: "retry-key" } }));
    const body = { requestId: "practice-key", revisionId: "r", drillId: "d", minutes: 10, reflection: "Timing" };
    await completeRoadmapDrill(body);
    expect(requestJson).toHaveBeenLastCalledWith(expect.objectContaining({ path: "/api/player/roadmap/practice", body }));
  });
  it("rejects a missing session before any HTTP request", async () => {
    jest.mocked(secureSessionStorage.getAccessToken).mockResolvedValue(null);
    await expect(getRoadmap()).rejects.toBeInstanceOf(ApiError);
    expect(requestJson).not.toHaveBeenCalled();
  });
  it("rejects success-shaped invalid responses", () => {
    expect(roadmapSchema.safeParse({ stage: "ADVANCED", score: 100 }).success).toBe(false);
  });

  it.each(["GEMINI", "OPENAI"])("accepts persisted %s provenance without losing older revisions", provider => {
    const revision = roadmapSchema.shape.revisions.element;
    expect(revision.safeParse({
      id: "r", createdAt: "2026-10-29T19:00:00.000Z", inputVersion: 1, profileVersion: 1,
      snapshot: {
        policyVersion: "self-reported-evidence-v1", provider, model: "actual-model",
        stage: "UNASSESSED", baseline: "SELF_REPORTED", evidence: [],
        recommendations: ["BATTING", "BOWLING", "KEEPING", "FIELDING"].map(discipline => ({
          discipline, objective: "Improve consistency", proposedStage: null, evidence: ["profile"], drills: [],
        })),
      },
    }).success).toBe(true);
  });
});
