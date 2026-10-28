import { Platform } from "react-native";

import { GoogleIdentityNative } from "../../modules/google-identity";

export type GoogleIdentityFailure =
  | "cancelled"
  | "no-account"
  | "unavailable"
  | "failed";

export class GoogleIdentityError extends Error {
  constructor(readonly reason: GoogleIdentityFailure, message: string) {
    super(message);
    this.name = "GoogleIdentityError";
  }
}

const failureByCode: Record<string, GoogleIdentityFailure> = {
  ERR_GOOGLE_SIGN_IN_CANCELLED: "cancelled",
  ERR_GOOGLE_SIGN_IN_NO_CREDENTIAL: "no-account",
  ERR_GOOGLE_SIGN_IN_UNAVAILABLE: "unavailable",
};

/** On-device Google sign-in is currently provided on Android only. */
export function isDeviceGoogleSignInAvailable(): boolean {
  return Platform.OS === "android" && GoogleIdentityNative !== null;
}

export async function getDeviceGoogleIdToken(
  clientId: string,
  nonce: string,
): Promise<string> {
  if (!isDeviceGoogleSignInAvailable() || !GoogleIdentityNative) {
    throw new GoogleIdentityError(
      "unavailable",
      "Google sign-in is not available on this device.",
    );
  }
  try {
    const idToken = await GoogleIdentityNative.getGoogleIdToken(clientId, nonce);
    if (typeof idToken !== "string" || idToken.length === 0) {
      throw new GoogleIdentityError("failed", "Google returned an empty credential.");
    }
    return idToken;
  } catch (error) {
    if (error instanceof GoogleIdentityError) throw error;
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    throw new GoogleIdentityError(
      failureByCode[code] ?? "failed",
      `Google sign-in failed (${code || "unknown"}).`,
    );
  }
}

/** Resets Google account selection so the next sign-in shows the account chooser. */
export async function clearDeviceGoogleCredentialState(): Promise<void> {
  if (!isDeviceGoogleSignInAvailable() || !GoogleIdentityNative) return;
  await GoogleIdentityNative.clearCredentialState();
}
