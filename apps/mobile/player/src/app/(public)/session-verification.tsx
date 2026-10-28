import { StyleSheet, Text } from "react-native";

import { FeedbackScreen } from "../../components/feedback/feedback-screen";
import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { useSession } from "../../session/session-context";
import { useAppTheme } from "../../theme/use-app-theme";

export default function SessionVerificationScreen() {
  const { signOut, signOutError } = useSession();
  const { colors } = useAppTheme();

  return (
    <AppScreen>
      <FeedbackScreen
        variant="unavailable"
        title="Session needs verification"
        message="A saved credential is not proof of approval or player access. Server-side session verification is not connected yet."
      />
      <Text style={[styles.message, { color: colors.mutedText }]}>
        You can remove the saved credential from this device.
      </Text>
      {signOutError ? (
        <Text
          accessibilityLiveRegion="assertive"
          style={[styles.error, { color: colors.error }]}
        >
          {signOutError}
        </Text>
      ) : null}
      <AppButton onPress={() => void signOut()} variant="secondary">
        Remove saved session
      </AppButton>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
    textAlign: "center",
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    textAlign: "center",
  },
});
