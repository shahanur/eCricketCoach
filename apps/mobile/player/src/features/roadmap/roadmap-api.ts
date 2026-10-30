import { z } from "zod";

import { requestJson } from "../../api/api-client";
import { ApiError } from "../../api/api-error";
import { secureSessionStorage } from "../../session/secure-session-storage";

export const roadmapDisciplines = ["BATTING", "BOWLING", "KEEPING", "FIELDING"] as const;
export type RoadmapDiscipline = typeof roadmapDisciplines[number];
const disciplineSchema = z.enum(roadmapDisciplines);
const answerSchema = z.object({ focus: z.string().min(1).max(300), confidence: z.number().int().min(1).max(5) });
export type RoadmapAnswers = Record<RoadmapDiscipline, z.infer<typeof answerSchema>>;
const drillSchema = z.object({
  id: z.string(), title: z.string(), discipline: disciplineSchema,
  instructions: z.string().nullable(), duration: z.number().int().positive(),
  reason: z.string(),
});
const revisionSchema = z.object({
  id: z.string(), createdAt: z.iso.datetime(), inputVersion: z.number().int(), profileVersion: z.number().int(),
  snapshot: z.object({
    policyVersion: z.string(), provider: z.enum(["GEMINI", "OPENAI"]), model: z.string(),
    stage: z.literal("UNASSESSED"), baseline: z.literal("SELF_REPORTED"),
    planKind: z.literal("PROVISIONAL_PRACTICE").optional(),
    evidence: z.array(z.object({ id: z.string(), source: z.string() }).passthrough()),
    recommendations: z.array(z.object({
      discipline: disciplineSchema, objective: z.string(), proposedStage: z.string().nullable(),
      evidence: z.array(z.string()), drills: z.array(drillSchema),
    })).length(4),
  }),
});
export const roadmapSchema = z.object({
  version: z.number().int().nonnegative(), profileVersion: z.number().int().nonnegative(),
  goals: z.array(z.string()), primaryDisciplines: z.array(disciplineSchema),
  answers: z.object({
    BATTING: answerSchema.optional(), BOWLING: answerSchema.optional(),
    KEEPING: answerSchema.optional(), FIELDING: answerSchema.optional(),
  }),
  stage: z.literal("UNASSESSED"), baseline: z.literal("SELF_REPORTED"),
  planKind: z.literal("PROVISIONAL_PRACTICE"),
  journey: z.object({
    nextStep: z.enum(["COMPLETE_PROFILE", "VIDEO_BASELINE"]),
    videoBaseline: z.literal("UNAVAILABLE"),
    personalRoadmap: z.literal("BLOCKED_PENDING_VERIFIED_VIDEO"),
    progressReview: z.literal("UNAVAILABLE"),
  }),
  milestoneEligibility: z.literal("BLOCKED_PENDING_VERIFIED_VIDEO_AND_APPROVED_RUBRIC"),
  policyVersion: z.string(), generating: z.boolean(), needsReassessment: z.boolean(),
  revisions: z.array(revisionSchema),
  practice: z.array(z.object({
    id: z.string(), revisionId: z.string(), drillId: z.string(), discipline: disciplineSchema,
    minutes: z.number().int(), reflection: z.string(), completedAt: z.iso.datetime(), source: z.literal("SELF_REPORTED"),
  })),
});
export type PlayerRoadmap = z.infer<typeof roadmapSchema>;
export type RoadmapDrill = z.infer<typeof drillSchema>;

async function request(path: string, body?: unknown, signal?: AbortSignal) {
  const token = await secureSessionStorage.getAccessToken();
  if (!token) throw new ApiError("Access token required.", "http", 401);
  return (await requestJson({
    path: `/api/player/roadmap${path}`, method: body === undefined ? "GET" : "POST",
    body, accessToken: token, signal, timeoutMs: body === undefined ? 15_000 : 180_000,
    responseSchema: z.object({ roadmap: roadmapSchema }),
  })).roadmap;
}

export const getRoadmap = (signal?: AbortSignal) => request("", undefined, signal);
export const saveRoadmapAnswers = (version: number, answers: RoadmapAnswers) => request("/answers", { version, answers });
export const generateRoadmap = (version: number, requestId: string) => request("/provisional/generate", { version, requestId });
export const completeRoadmapDrill = (input: {
  requestId: string; revisionId: string; drillId: string; minutes: number; reflection: string;
}) => request("/practice", input);

let sequence = 0;
export function roadmapRequestId() {
  sequence += 1;
  return `roadmap-${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
}
