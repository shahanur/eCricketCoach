import { Redirect, Stack, useSegments } from "expo-router";

import { useSession } from "../../session/session-context";
import { getSessionDestination } from "../../session/session-state";

export default function PublicLayout() {
  const { state } = useSession();
  const segments = useSegments();
  const screen = segments[segments.length - 1];
  const destination = getSessionDestination(state);
  const sessionScreen = screen === "access-unavailable" ||
    screen === "approval" || screen === "session-verification";
  if (destination &&
      ((state.status === "active" && state.hasPlayerEntitlement) ||
        (sessionScreen && destination !== `/(public)/${screen}`))) {
    return <Redirect href={destination} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
