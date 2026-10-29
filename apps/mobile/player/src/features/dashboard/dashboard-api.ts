import { z } from "zod";

import { requestJson } from "../../api/api-client";
import { ApiError } from "../../api/api-error";
import { secureSessionStorage } from "../../session/secure-session-storage";

export const dashboardSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("NONE"),
    progress: z.null(),
    focus: z.null(),
    notification: z.null(),
  }),
  z.object({
    source: z.literal("DEVELOPMENT_SEED"),
    progress: z.object({ percent: z.number().int().min(0).max(100), stage: z.string().min(1) }),
    focus: z.object({
      title: z.string().min(1),
      discipline: z.string().min(1),
      minutes: z.number().int().min(1).max(180),
      description: z.string().min(1),
    }),
    notification: z.string().min(1),
  }),
]);

export type PlayerDashboard = z.infer<typeof dashboardSchema>;

export async function getPlayerDashboard(signal?: AbortSignal): Promise<PlayerDashboard> {
  const accessToken = await secureSessionStorage.getAccessToken();
  if (!accessToken) throw new ApiError("Access token required.", "http", 401);
  return (await requestJson({
    path: "/api/player/dashboard",
    responseSchema: z.object({ dashboard: dashboardSchema }),
    accessToken,
    signal,
  })).dashboard;
}
