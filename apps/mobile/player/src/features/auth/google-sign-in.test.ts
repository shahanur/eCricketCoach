import { ApiError } from "../../api/api-error";
import { GoogleIdentityError } from "../../platform/google-identity";
import {
  REGISTRATION_REQUIRED_MESSAGE,
  signInWithGoogleOnDevice,
  type GoogleSignInDependencies,
} from "./google-sign-in";

function dependencies(
  overrides: Partial<GoogleSignInDependencies> = {},
): GoogleSignInDependencies {
  return {
    getChallenge: jest.fn(async () => ({
      clientId: "web-client-id",
      nonce: "nonce-1",
      challenge: "signed-challenge",
    })),
    getIdToken: jest.fn(async () => "google-id-token"),
    exchange: jest.fn(async () => "session-token"),
    ...overrides,
  };
}

describe("signInWithGoogleOnDevice", () => {
  it("binds the device credential to the server nonce and exchanges it", async () => {
    const deps = dependencies();

    await expect(signInWithGoogleOnDevice(deps)).resolves.toEqual({
      status: "signed-in",
      accessToken: "session-token",
    });
    expect(deps.getIdToken).toHaveBeenCalledWith("web-client-id", "nonce-1");
    expect(deps.exchange).toHaveBeenCalledWith("google-id-token", "signed-challenge");
  });

  it("treats a dismissed account chooser as a quiet cancellation", async () => {
    const deps = dependencies({
      getIdToken: jest.fn(async () => {
        throw new GoogleIdentityError("cancelled", "cancelled");
      }),
    });

    await expect(signInWithGoogleOnDevice(deps)).resolves.toEqual({ status: "cancelled" });
    expect(deps.exchange).not.toHaveBeenCalled();
  });

  it("guides players without a Google account on the device", async () => {
    const outcome = await signInWithGoogleOnDevice(
      dependencies({
        getIdToken: jest.fn(async () => {
          throw new GoogleIdentityError("no-account", "none");
        }),
      }),
    );

    expect(outcome).toMatchObject({ status: "failed", reason: "no-google-account" });
  });

  it("explains when the account still needs registration or approval", async () => {
    const outcome = await signInWithGoogleOnDevice(
      dependencies({
        exchange: jest.fn(async () => {
          throw new ApiError("Finish registration", "http", 403, "REGISTRATION_REQUIRED");
        }),
      }),
    );

    expect(outcome).toEqual({
      status: "failed",
      reason: "registration-required",
      message: REGISTRATION_REQUIRED_MESSAGE,
    });
  });

  it("does not show server diagnostics for rejected Google tokens", async () => {
    const outcome = await signInWithGoogleOnDevice(
      dependencies({
        exchange: jest.fn(async () => {
          throw new ApiError("Google sign-in is invalid or expired.", "http", 401);
        }),
      }),
    );

    expect(outcome).toEqual({
      status: "failed",
      reason: "error",
      message: "We couldn't verify your Google sign-in. Please try again.",
    });
  });

  it("reports offline challenge requests with friendly copy", async () => {
    const outcome = await signInWithGoogleOnDevice(
      dependencies({
        getChallenge: jest.fn(async () => {
          throw new ApiError("Could not reach the server.", "network");
        }),
      }),
    );

    expect(outcome).toEqual({
      status: "failed",
      reason: "error",
      message: "You appear to be offline. Check your connection and try again.",
    });
  });

  it("reports an unconfigured Google service as temporarily unavailable", async () => {
    const outcome = await signInWithGoogleOnDevice(
      dependencies({
        getChallenge: jest.fn(async () => {
          throw new ApiError("Google sign-in is not configured.", "http", 503);
        }),
      }),
    );

    expect(outcome).toMatchObject({ status: "failed", reason: "unavailable" });
  });
});
