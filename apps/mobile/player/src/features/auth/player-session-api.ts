import { z } from "zod";

import { requestJson } from "../../api/api-client";

const googleChallengeSchema = z.object({
  clientId: z.string().min(1),
  nonce: z.string().min(1),
  challenge: z.string().min(1),
});

const googleSessionSchema = z.object({
  authToken: z.string().min(1),
});

const playerAccessSchema = z.object({
  access: z.enum(["ACTIVE", "UNAVAILABLE"]),
  email: z.string(),
  displayName: z.string().nullable(),
  reason: z.enum(["ACCOUNT_TYPE_MISMATCH", "PLAYER_ACCESS_UNAVAILABLE"]).optional(),
});

export type GoogleSignInChallenge = z.infer<typeof googleChallengeSchema>;
export type PlayerAccess = z.infer<typeof playerAccessSchema>;

/** Five-minute, server-signed nonce challenge for a native Google sign-in. */
export function getGoogleSignInChallenge(
  signal?: AbortSignal,
): Promise<GoogleSignInChallenge> {
  return requestJson({
    path: "/api/auth/google/native",
    responseSchema: googleChallengeSchema,
    signal,
  });
}

/**
 * Exchanges a nonce-bound Google ID token for an eCricketCoach session token.
 * Unknown or not-yet-approved accounts fail with HTTP 403 and code
 * `REGISTRATION_REQUIRED`.
 */
export async function exchangeGoogleIdToken(
  idToken: string,
  challenge: string,
  signal?: AbortSignal,
): Promise<string> {
  const session = await requestJson({
    path: "/api/auth/google/native",
    method: "POST",
    body: { idToken, challenge },
    responseSchema: googleSessionSchema,
    signal,
  });
  return session.authToken;
}

/** Server-derived Individual Player access for the session token. */
export function getPlayerAccess(
  accessToken: string,
  signal?: AbortSignal,
): Promise<PlayerAccess> {
  return requestJson({
    path: "/api/auth/player-access",
    responseSchema: playerAccessSchema,
    accessToken,
    signal,
  });
}
