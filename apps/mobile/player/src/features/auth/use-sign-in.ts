import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { getUserFacingErrorMessage } from "../../api/api-error";
import { useSession } from "../../session/session-context";
import { signInWithGoogleOnDevice } from "./google-sign-in";

export type SignInFeedback = {
  kind: "error" | "registration-required";
  message: string;
};

export function useSignIn() {
  const router = useRouter();
  const { completeSignIn } = useSession();
  const [signingIn, setSigningIn] = useState(false);
  const [feedback, setFeedback] = useState<SignInFeedback | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
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

  return { signingIn, feedback, signInWithGoogle };
}
