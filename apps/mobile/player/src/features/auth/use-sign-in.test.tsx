import { act, renderHook } from "@testing-library/react-native";

import { useSession } from "../../session/session-context";
import { signInWithGoogleOnDevice } from "./google-sign-in";
import { useSignIn } from "./use-sign-in";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock("../../session/session-context", () => ({ useSession: jest.fn() }));
jest.mock("./google-sign-in", () => ({ signInWithGoogleOnDevice: jest.fn() }));

describe("direct Google sign-in", () => {
  const completeSignIn = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useSession).mockReturnValue({
      state: { status: "signedOut" }, completeSignIn, signOut: jest.fn(),
      signOutError: null, restoreError: null, retryRestore: jest.fn(),
    });
  });

  it("launches Google directly, verifies access, and navigates after completion", async () => {
    jest.mocked(signInWithGoogleOnDevice).mockResolvedValue({ status: "signed-in", accessToken: "session" });
    const hook = await renderHook(() => useSignIn());
    await act(async () => { await hook.result.current.signInWithGoogle(); });
    expect(signInWithGoogleOnDevice).toHaveBeenCalledTimes(1);
    expect(completeSignIn).toHaveBeenCalledWith("session");
    expect(mockReplace).toHaveBeenCalledWith("/");
    expect(hook.result.current.signingIn).toBe(false);
  });

  it("does not grant a session on failure and permits a retry", async () => {
    jest.mocked(signInWithGoogleOnDevice).mockResolvedValue({
      status: "failed", reason: "error", message: "Check your connection and try again.",
    });
    const hook = await renderHook(() => useSignIn());
    await act(async () => { await hook.result.current.signInWithGoogle(); });
    expect(hook.result.current.feedback?.message).toBe("Check your connection and try again.");
    expect(completeSignIn).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(hook.result.current.signingIn).toBe(false);
    await act(async () => { await hook.result.current.signInWithGoogle(); });
    expect(signInWithGoogleOnDevice).toHaveBeenCalledTimes(2);
  });
});
