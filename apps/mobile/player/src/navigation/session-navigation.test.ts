import { getSessionDestination, type SessionState } from "../session/session-state";

describe("getSessionDestination", () => {
  it.each([
    [{ status: "restoring" }, null],
    [{ status: "restoreError" }, null],
    [{ status: "signedOut" }, "/(public)/welcome"],
    [{ status: "verificationRequired" }, "/(public)/session-verification"],
    [{ status: "pendingApproval" }, "/(public)/approval"],
    [
      {
        status: "active",
        hasPlayerEntitlement: false,
        email: "player@example.test",
        displayName: null,
      },
      "/(public)/access-unavailable",
    ],
    [{
      status: "active",
      hasPlayerEntitlement: true,
      email: "player@example.test",
      displayName: "Asha",
    }, "/(app)/(tabs)/home"],
  ] satisfies [SessionState, string | null][])(
    "routes %p safely",
    (state, expected) => {
      expect(getSessionDestination(state)).toBe(expected);
    },
  );
});
