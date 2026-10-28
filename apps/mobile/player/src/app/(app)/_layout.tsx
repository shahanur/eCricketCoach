import { Redirect, Slot } from "expo-router";

import { FeedbackScreen } from "../../components/feedback/feedback-screen";
import { AppScreen } from "../../components/layout/app-screen";
import { useSession } from "../../session/session-context";
import { getSessionDestination } from "../../session/session-state";

export default function ProtectedLayout() {
  const { state, restoreError, retryRestore } = useSession();

  if (state.status === "restoring") {
    return (
      <AppScreen>
        <FeedbackScreen
          variant="loading"
          title="Restoring session"
          message="Checking secure session storage."
        />
      </AppScreen>
    );
  }

  if (state.status === "restoreError") {
    return (
      <AppScreen>
        <FeedbackScreen
          variant="error"
          title="Session could not be restored"
          message={restoreError ?? "Secure session storage is unavailable."}
          onRetry={retryRestore}
        />
      </AppScreen>
    );
  }

  if (state.status === "active" && state.hasPlayerEntitlement) {
    return <Slot />;
  }

  const destination = getSessionDestination(state);
  return destination ? <Redirect href={destination} /> : null;
}
