import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { getUserFacingErrorMessage } from "../../api/api-error";
import { isDeviceGoogleSignInAvailable } from "../../platform/google-identity";
import { useSession } from "../../session/session-context";
import { getSignInOptions, type AuthProvider } from "./auth-providers";
import { signInWithGoogleOnDevice } from "./google-sign-in";

export type SignInOptionsState =
  | { status: "loading" }
  | {
      status: "ready";
      deviceGoogle: boolean;
      websiteProviders: AuthProvider[];
    }
  | { status: "error"; message: string };

export type SignInFeedback = {
  kind: "error" | "registration-required";
  message: string;
};

async function loadOptions(signal?: AbortSignal): Promise<SignInOptionsState> {
  try {
    const options = await getSignInOptions(signal);
    return {
      status: "ready",
      deviceGoogle: options.nativeGoogle && isDeviceGoogleSignInAvailable(),
      websiteProviders: options.websiteProviders,
    };
  } catch (error) {
    return { status: "error", message: getUserFacingErrorMessage(error) };
  }
}

export function useSignIn() {
  const router = useRouter();
  const { completeSignIn } = useSession();
  const [options, setOptions] = useState<SignInOptionsState>({ status: "loading" });
  const [signingIn, setSigningIn] = useState(false);
  const [feedback, setFeedback] = useState<SignInFeedback | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void loadOptions(controller.signal).then((state) => {
      if (!controller.signal.aborted) setOptions(state);
    });
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, []);

  const retryOptions = useCallback(() => {
    setOptions({ status: "loading" });
    void loadOptions().then((state) => {
      if (mounted.current) setOptions(state);
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSigningIn(true);
    setFeedback(null);
    try {
      const outcome = await signInWithGoogleOnDevice();
      if (outcome.status === "cancelled") return;
      if (outcome.status === "failed") {
        if (mounted.current) {
          setFeedback({
            kind:
              outcome.reason === "registration-required"
                ? "registration-required"
                : "error",
            message: outcome.message,
          });
        }
        return;
      }
      await completeSignIn(outcome.accessToken);
      router.replace("/");
    } catch (error) {
      if (mounted.current) {
        setFeedback({ kind: "error", message: getUserFacingErrorMessage(error) });
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSigningIn(false);
    }
  }, [completeSignIn, router]);

  return { options, retryOptions, signingIn, feedback, signInWithGoogle };
}
