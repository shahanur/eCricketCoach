import { ApiError } from "../api/api-error";
import { restoreSessionState } from "./session-state";

const neverCalled = jest.fn(async () => {
  throw new Error("access should not be checked");
});

describe("restoreSessionState", () => {
  afterEach(() => jest.clearAllMocks());

  it("starts signed out when secure storage is empty", async () => {
    await expect(restoreSessionState(async () => null, neverCalled)).resolves.toEqual({
      status: "signedOut",
    });
    expect(neverCalled).not.toHaveBeenCalled();
  });

  it("activates only after the server confirms Individual Player access", async () => {
    const checkAccess = jest.fn(async () => ({
      access: "ACTIVE" as const,
      email: "player@example.test",
      displayName: "Asha",
    }));

    await expect(
      restoreSessionState(async () => "saved-bearer-token", checkAccess),
    ).resolves.toEqual({
      status: "active",
      hasPlayerEntitlement: true,
      email: "player@example.test",
      displayName: "Asha",
    });
    expect(checkAccess).toHaveBeenCalledWith("saved-bearer-token");
  });

  it("keeps accounts without a player plan out of the app", async () => {
    await expect(
      restoreSessionState(async () => "saved-bearer-token", async () => ({
        access: "UNAVAILABLE",
        email: "player@example.test",
        displayName: null,
      })),
    ).resolves.toEqual({
      status: "active",
      hasPlayerEntitlement: false,
      email: "player@example.test",
      displayName: null,
    });
  });

  it("asks the player to sign in again when the session is rejected", async () => {
    await expect(
      restoreSessionState(async () => "expired-token", async () => {
        throw new ApiError("expired", "http", 401);
      }),
    ).resolves.toEqual({ status: "verificationRequired" });
  });

  it("rethrows connectivity and server failures so they can be retried", async () => {
    await expect(
      restoreSessionState(async () => "saved-bearer-token", async () => {
        throw new ApiError("offline", "network");
      }),
    ).rejects.toMatchObject({ kind: "network" });
    await expect(
      restoreSessionState(async () => "saved-bearer-token", async () => {
        throw new ApiError("down", "http", 500);
      }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it("surfaces secure-storage failures to the session provider", async () => {
    await expect(
      restoreSessionState(async () => {
        throw new Error("storage unavailable");
      }, neverCalled),
    ).rejects.toThrow("storage unavailable");
  });
});
