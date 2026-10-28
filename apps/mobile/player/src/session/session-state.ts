import { ApiError } from "../api/api-error";

export type SessionState =
  | { status: "restoring" }
  | { status: "restoreError" }
  | { status: "signedOut" }
  | { status: "verificationRequired" }
  | { status: "pendingApproval" }
  | {
      status: "active";
      hasPlayerEntitlement: boolean;
      email: string;
      displayName: string | null;
      accessReason?: PlayerAccessResult["reason"];
    };

export type SessionDestination =
  | "/(public)/welcome"
  | "/(public)/session-verification"
  | "/(public)/approval"
  | "/(public)/access-unavailable"
  | "/(app)/(tabs)/home";

export function getSessionDestination(
  state: SessionState,
): SessionDestination | null {
  switch (state.status) {
    case "restoring":
    case "restoreError":
      return null;
    case "signedOut":
      return "/(public)/welcome";
    case "verificationRequired":
      return "/(public)/session-verification";
    case "pendingApproval":
      return "/(public)/approval";
    case "active":
      return state.hasPlayerEntitlement
        ? "/(app)/(tabs)/home"
        : "/(public)/access-unavailable";
  }
}

export type PlayerAccessResult = {
  access: "ACTIVE" | "UNAVAILABLE";
  email: string;
  displayName: string | null;
  reason?: "ACCOUNT_TYPE_MISMATCH" | "PLAYER_ACCESS_UNAVAILABLE";
};

export function sessionStateFromAccess(access: PlayerAccessResult): SessionState {
  return {
    status: "active",
    hasPlayerEntitlement: access.access === "ACTIVE",
    email: access.email,
    displayName: access.displayName,
    ...(access.access === "UNAVAILABLE" && access.reason ? { accessReason: access.reason } : {}),
  };
}

/**
 * A stored token is only trusted after the server confirms it. An expired or
 * rejected token asks the player to sign in again; connectivity failures are
 * rethrown so the caller can offer a retry without discarding the session.
 */
export async function restoreSessionState(
  readAccessToken: () => Promise<string | null>,
  checkAccess: (accessToken: string) => Promise<PlayerAccessResult>,
): Promise<SessionState> {
  const token = await readAccessToken();
  if (!token) return { status: "signedOut" };
  try {
    return sessionStateFromAccess(await checkAccess(token));
  } catch (error) {
    if (error instanceof ApiError && error.kind === "http" && error.status === 401) {
      return { status: "verificationRequired" };
    }
    throw error;
  }
}
