export type SessionState =
  | { status: "restoring" }
  | { status: "restoreError" }
  | { status: "signedOut" }
  | { status: "verificationRequired" }
  | { status: "pendingApproval" }
  | { status: "active"; hasPlayerEntitlement: boolean };

export type SessionDestination =
  | "/(public)/welcome"
  | "/(public)/session-verification"
  | "/(public)/approval"
  | "/(public)/access-unavailable"
  | "/(app)/(tabs)";

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
        ? "/(app)/(tabs)"
        : "/(public)/access-unavailable";
  }
}

export async function restoreSessionState(
  readAccessToken: () => Promise<string | null>,
): Promise<SessionState> {
  const token = await readAccessToken();
  return token ? { status: "verificationRequired" } : { status: "signedOut" };
}
