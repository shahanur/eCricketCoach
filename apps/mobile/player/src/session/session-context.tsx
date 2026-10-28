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

import { secureSessionStorage } from "./secure-session-storage";
import { restoreSessionState, type SessionState } from "./session-state";

type SessionContextValue = {
  state: SessionState;
  restoreError: string | null;
  signOutError: string | null;
  retryRestore: () => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({ status: "restoring" });
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const restoreAttempt = useRef(0);

  const retryRestore = useCallback(() => {
    setRestoreError(null);
    setState({ status: "restoring" });
    const attempt = ++restoreAttempt.current;
    void secureSessionStorage
      .getAccessToken()
      .then((token) => {
        if (attempt === restoreAttempt.current) {
          setState(
            token
              ? { status: "verificationRequired" }
              : { status: "signedOut" },
          );
        }
      })
      .catch(() => {
        if (attempt === restoreAttempt.current) {
          setRestoreError("Secure session storage could not be read. Try again.");
          setState({ status: "restoreError" });
        }
      });
  }, []);

  const signOut = useCallback(async () => {
    setSignOutError(null);
    try {
      await secureSessionStorage.clearAccessToken();
      setState({ status: "signedOut" });
    } catch {
      setSignOutError("The saved session could not be removed. Try again.");
    }
  }, []);

  useEffect(() => {
    const attempt = ++restoreAttempt.current;
    void restoreSessionState(secureSessionStorage.getAccessToken)
      .then((restoredState) => {
        if (attempt === restoreAttempt.current) {
          setState(restoredState);
        }
      })
      .catch(() => {
        if (attempt === restoreAttempt.current) {
          setRestoreError("Secure session storage could not be read. Try again.");
          setState({ status: "restoreError" });
        }
      });
    return () => {
      restoreAttempt.current += 1;
    };
  }, []);

  const value = useMemo(
    () => ({ state, restoreError, signOutError, retryRestore, signOut }),
    [restoreError, retryRestore, signOut, signOutError, state],
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
