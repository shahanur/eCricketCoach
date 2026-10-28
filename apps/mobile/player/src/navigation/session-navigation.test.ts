import { getSessionDestination, type SessionState } from "../session/session-state";

describe("getSessionDestination", () => {
  it.each([
    [{ status: "restoring" }, null],
    [{ status: "restoreError" }, null],
    [{ status: "signedOut" }, "/(public)/welcome"],
    [{ status: "verificationRequired" }, "/(public)/session-verification"],
    [{ status: "pendingApproval" }, "/(public)/approval"],
    [
      { status: "active", hasPlayerEntitlement: false },
      "/(public)/access-unavailable",
    ],
    [{ status: "active", hasPlayerEntitlement: true }, "/(app)/(tabs)"],
  ] satisfies [SessionState, string | null][])(
    "routes %p safely",
    (state, expected) => {
      expect(getSessionDestination(state)).toBe(expected);
    },
  );
});
