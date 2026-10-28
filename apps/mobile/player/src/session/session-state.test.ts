import { restoreSessionState } from "./session-state";

describe("restoreSessionState", () => {
  it("starts signed out when secure storage is empty", async () => {
    await expect(restoreSessionState(async () => null)).resolves.toEqual({
      status: "signedOut",
    });
  });

  it("never treats a stored access token as approved or entitled", async () => {
    await expect(
      restoreSessionState(async () => "saved-bearer-token"),
    ).resolves.toEqual({ status: "verificationRequired" });
  });

  it("surfaces secure-storage failures to the session provider", async () => {
    await expect(
      restoreSessionState(async () => {
        throw new Error("storage unavailable");
      }),
    ).rejects.toThrow("storage unavailable");
  });
});
