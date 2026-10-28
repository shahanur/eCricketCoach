import { StyleSheet, Text, View } from "react-native";

import { BrandMark } from "../../components/brand/brand-mark";
import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { StatusBadge } from "../../components/ui/player-card";
import { useSession } from "../../session/session-context";
import { useAppTheme } from "../../theme/use-app-theme";

export default function SessionVerificationScreen() {
  const { signOut, signOutError } = useSession();
  const { colors } = useAppTheme();

  return (
    <AppScreen>
      <View style={styles.content}>
        <BrandMark />
        <View style={styles.body}>
          <StatusBadge label="Keep your account safe" />
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            Please sign in again
          </Text>
          <Text style={[styles.message, { color: colors.mutedText }]}>
            For your security, we need to confirm your account before you
            continue.
          </Text>
        </View>
        {signOutError ? (
          <Text accessibilityLiveRegion="assertive" style={[styles.error, { color: colors.error }]}>
            {signOutError}
          </Text>
        ) : null}
        <AppButton onPress={() => void signOut()}>Continue</AppButton>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 24,
    paddingVertical: 16,
  },
  body: {
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
  },
  message: {
    fontSize: 17,
    lineHeight: 26,
  },
  error: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
});
