import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { getUserFacingErrorMessage } from "../api/api-error";
import { getPlayerAccess } from "../features/auth/player-session-api";
import { clearDeviceGoogleCredentialState } from "../platform/google-identity";
import { secureSessionStorage } from "./secure-session-storage";
import {
  restoreSessionState,
  sessionStateFromAccess,
  type SessionState,
} from "./session-state";

type SessionContextValue = {
  state: SessionState;
  restoreError: string | null;
  signOutError: string | null;
  retryRestore: () => void;
  /**
   * Confirms player access for a new session token. Only tokens for an active
   * Individual Player plan are kept in secure storage. Rejects with the API
   * error when access cannot be confirmed.
   */
  completeSignIn: (accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({ status: "restoring" });
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const restoreAttempt = useRef(0);

  const restore = useCallback((attempt: number) => {
    void restoreSessionState(secureSessionStorage.getAccessToken, (token) =>
      getPlayerAccess(token),
    )
      .then((restoredState) => {
        if (attempt === restoreAttempt.current) {
          setState(restoredState);
        }
      })
      .catch((error: unknown) => {
        if (attempt === restoreAttempt.current) {
          setRestoreError(getUserFacingErrorMessage(error));
          setState({ status: "restoreError" });
        }
      });
  }, []);

  const retryRestore = useCallback(() => {
    setRestoreError(null);
    setState({ status: "restoring" });
    restore(++restoreAttempt.current);
  }, [restore]);

  const completeSignIn = useCallback(async (accessToken: string) => {
    const access = await getPlayerAccess(accessToken);
    if (access.access === "ACTIVE") {
      await secureSessionStorage.setAccessToken(accessToken);
    }
    restoreAttempt.current += 1;
    setSignOutError(null);
    setState(sessionStateFromAccess(access));
  }, []);

  const signOut = useCallback(async () => {
    setSignOutError(null);
    try {
      await secureSessionStorage.clearAccessToken();
    } catch {
      setSignOutError("We couldn't sign you out. Please try again.");
      return;
    }
    restoreAttempt.current += 1;
    setState({ status: "signedOut" });
    // Account selection reset is best effort; the session is already removed.
    await clearDeviceGoogleCredentialState().catch(() => undefined);
  }, []);

  useEffect(() => {
    restore(++restoreAttempt.current);
    return () => {
      restoreAttempt.current += 1;
    };
  }, [restore]);

  const value = useMemo(
    () => ({
      state,
      restoreError,
      signOutError,
      retryRestore,
      completeSignIn,
      signOut,
    }),
    [completeSignIn, restoreError, retryRestore, signOut, signOutError, state],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider.");
  }
  return context;
}
