import { ApiError, getUserFacingErrorMessage } from "../../api/api-error";
import {
  GoogleIdentityError,
  getDeviceGoogleIdToken,
} from "../../platform/google-identity";
import {
  exchangeGoogleIdToken,
  getGoogleSignInChallenge,
} from "./player-session-api";

export type GoogleSignInFailure =
  | "registration-required"
  | "no-google-account"
  | "unavailable"
  | "error";

export type GoogleSignInOutcome =
  | { status: "signed-in"; accessToken: string }
  | { status: "cancelled" }
  | { status: "failed"; reason: GoogleSignInFailure; message: string };

export type GoogleSignInDependencies = {
  getChallenge: typeof getGoogleSignInChallenge;
  getIdToken: typeof getDeviceGoogleIdToken;
  exchange: typeof exchangeGoogleIdToken;
};

const defaultDependencies: GoogleSignInDependencies = {
  getChallenge: getGoogleSignInChallenge,
  getIdToken: getDeviceGoogleIdToken,
  exchange: exchangeGoogleIdToken,
};

export const REGISTRATION_REQUIRED_MESSAGE =
  "We couldn't find an active player account for this Google account. If you registered recently, your account may still be awaiting approval.";

/**
 * Runs the native Google flow: server nonce challenge, on-device account
 * chooser, then server-side ID token verification. The Google ID token is
 * never stored.
 */
export async function signInWithGoogleOnDevice(
  dependencies: GoogleSignInDependencies = defaultDependencies,
): Promise<GoogleSignInOutcome> {
  try {
    const challenge = await dependencies.getChallenge();
    const idToken = await dependencies.getIdToken(
      challenge.clientId,
      challenge.nonce,
    );
    const accessToken = await dependencies.exchange(idToken, challenge.challenge);
    return { status: "signed-in", accessToken };
  } catch (error) {
    return describeFailure(error);
  }
}

function describeFailure(error: unknown): GoogleSignInOutcome {
  if (error instanceof GoogleIdentityError) {
    switch (error.reason) {
      case "cancelled":
        return { status: "cancelled" };
      case "no-account":
        return {
          status: "failed",
          reason: "no-google-account",
          message: "Add a Google account to this device, then try again.",
        };
      case "unavailable":
        return {
          status: "failed",
          reason: "unavailable",
          message:
            "Google sign-in isn't available on this device. You can continue on the eCricketCoach website instead.",
        };
      case "failed":
        return {
          status: "failed",
          reason: "error",
          message: "We couldn't sign you in with Google. Please try again.",
        };
    }
  }

  if (error instanceof ApiError && error.kind === "http") {
    if (error.status === 403 && error.code === "REGISTRATION_REQUIRED") {
      return {
        status: "failed",
        reason: "registration-required",
        message: REGISTRATION_REQUIRED_MESSAGE,
      };
    }
    if (error.status === 401) {
      return {
        status: "failed",
        reason: "error",
        message: "We couldn't verify your Google sign-in. Please try again.",
      };
    }
    if (error.status === 503) {
      return {
        status: "failed",
        reason: "unavailable",
        message:
          "Google sign-in is temporarily unavailable. Please try again shortly.",
      };
    }
  }

  return {
    status: "failed",
    reason: "error",
    message: getUserFacingErrorMessage(error),
  };
}
