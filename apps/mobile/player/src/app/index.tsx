import { Redirect } from "expo-router";

import { FeedbackScreen } from "../components/feedback/feedback-screen";
import { AppScreen } from "../components/layout/app-screen";
import { useSession } from "../session/session-context";
import { getSessionDestination } from "../session/session-state";

export default function EntryRoute() {
  const { state, restoreError, retryRestore } = useSession();

  if (state.status === "restoring") {
    return (
      <AppScreen>
        <FeedbackScreen
          variant="loading"
          title="Getting things ready"
          message="Just a moment."
        />
      </AppScreen>
    );
  }

  if (state.status === "restoreError") {
    return (
      <AppScreen>
        <FeedbackScreen
          variant="error"
          title="Something went wrong"
          message={restoreError ?? "We couldn't load your account on this device. Please try again."}
          onRetry={retryRestore}
        />
      </AppScreen>
    );
  }

  const destination = getSessionDestination(state);
  return destination ? <Redirect href={destination} /> : null;
}
