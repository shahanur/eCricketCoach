import { z } from "zod";

import { ApiError } from "../../api/api-error";
import { requestJson } from "../../api/api-client";
import { secureSessionStorage } from "../../session/secure-session-storage";

export const playerProfileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).max(80),
  battingHandedness: z.enum(["NOT_SET", "RIGHT", "LEFT"]),
  bowlingStyle: z.enum([
    "NOT_SET",
    "RIGHT_ARM_FAST",
    "LEFT_ARM_FAST",
    "RIGHT_ARM_SPIN",
    "LEFT_ARM_SPIN",
  ]),
  primaryDisciplines: z.array(z.enum(["BATTING", "BOWLING", "KEEPING", "FIELDING"])).max(4),
  experienceLevel: z.enum(["NOT_SET", "BEGINNER", "DEVELOPING", "INTERMEDIATE", "ADVANCED"]),
  goals: z.array(z.string().min(1).max(120)).max(3),
  isComplete: z.boolean(),
  version: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const profileResponseSchema = z.object({ profile: playerProfileSchema });

export const playerProfileUpdateSchema = playerProfileSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isComplete: true,
});

export type PlayerProfile = z.infer<typeof playerProfileSchema>;
export type PlayerProfileUpdate = z.infer<typeof playerProfileUpdateSchema>;

async function getAccessToken(): Promise<string> {
  const accessToken = await secureSessionStorage.getAccessToken();
  if (!accessToken) throw new ApiError("Access token required.", "http", 401);
  return accessToken;
}

export async function getPlayerProfile(signal?: AbortSignal): Promise<PlayerProfile> {
  return (await requestJson({
    path: "/api/player/profile",
    responseSchema: profileResponseSchema,
    accessToken: await getAccessToken(),
    signal,
  })).profile;
}

export async function updatePlayerProfile(
  profile: PlayerProfileUpdate,
  signal?: AbortSignal,
): Promise<PlayerProfile> {
  const parsed = playerProfileUpdateSchema.safeParse(profile);
  if (!parsed.success) throw new ApiError("Invalid player profile.", "invalid-request");
  return (await requestJson({
    path: "/api/player/profile",
    method: "PUT",
    body: parsed.data,
    responseSchema: profileResponseSchema,
    accessToken: await getAccessToken(),
    signal,
  })).profile;
}
