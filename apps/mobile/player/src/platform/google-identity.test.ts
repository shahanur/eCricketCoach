import { Platform } from "react-native";

import { GoogleIdentityNative } from "../../modules/google-identity";
import {
  GoogleIdentityError,
  clearDeviceGoogleCredentialState,
  getDeviceGoogleIdToken,
  isDeviceGoogleSignInAvailable,
} from "./google-identity";

jest.mock("../../modules/google-identity", () => ({
  GoogleIdentityNative: {
    getGoogleIdToken: jest.fn(),
    clearCredentialState: jest.fn(),
  },
}));

const native = GoogleIdentityNative as unknown as {
  getGoogleIdToken: jest.Mock;
  clearCredentialState: jest.Mock;
};

function nativeError(code: string) {
  return Object.assign(new Error("native failure"), { code });
}

describe("device Google identity", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("is unavailable outside Android", async () => {
    jest.replaceProperty(Platform, "OS", "ios");

    expect(isDeviceGoogleSignInAvailable()).toBe(false);
    await expect(getDeviceGoogleIdToken("client", "nonce")).rejects.toMatchObject({
      reason: "unavailable",
    });
    await clearDeviceGoogleCredentialState();
    expect(native.getGoogleIdToken).not.toHaveBeenCalled();
    expect(native.clearCredentialState).not.toHaveBeenCalled();
  });

  describe("on Android", () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, "OS", "android");
    });

    it("returns the nonce-bound ID token", async () => {
      native.getGoogleIdToken.mockResolvedValue("id-token");

      await expect(getDeviceGoogleIdToken("client", "nonce")).resolves.toBe("id-token");
      expect(native.getGoogleIdToken).toHaveBeenCalledWith("client", "nonce");
    });

    it.each([
      ["ERR_GOOGLE_SIGN_IN_CANCELLED", "cancelled"],
      ["ERR_GOOGLE_SIGN_IN_NO_CREDENTIAL", "no-account"],
      ["ERR_GOOGLE_SIGN_IN_UNAVAILABLE", "unavailable"],
      ["ERR_GOOGLE_SIGN_IN_FAILED", "failed"],
      ["SOMETHING_UNEXPECTED", "failed"],
    ])("maps %s to %s", async (code, reason) => {
      native.getGoogleIdToken.mockRejectedValue(nativeError(code));

      const failure = await getDeviceGoogleIdToken("client", "nonce").catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(GoogleIdentityError);
      expect(failure).toMatchObject({ reason });
    });

    it("rejects an empty credential", async () => {
      native.getGoogleIdToken.mockResolvedValue("");

      await expect(getDeviceGoogleIdToken("client", "nonce")).rejects.toMatchObject({
        reason: "failed",
      });
    });

    it("resets Google account selection on sign-out", async () => {
      native.clearCredentialState.mockResolvedValue(null);

      await clearDeviceGoogleCredentialState();
      expect(native.clearCredentialState).toHaveBeenCalledTimes(1);
    });
  });
});
