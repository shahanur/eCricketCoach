import { requireOptionalNativeModule } from "expo";

export type GoogleIdentityNativeModule = {
  getGoogleIdToken(clientId: string, nonce: string): Promise<string>;
  clearCredentialState(): Promise<null>;
};

/** Android-only native module; null on iOS, web, and builds without it. */
export const GoogleIdentityNative =
  requireOptionalNativeModule<GoogleIdentityNativeModule>("GoogleIdentity");
