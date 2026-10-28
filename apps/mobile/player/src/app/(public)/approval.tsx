import { StyleSheet, Text, View } from "react-native";

import { BrandMark } from "../../components/brand/brand-mark";
import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { useSession } from "../../session/session-context";
import { useAppTheme } from "../../theme/use-app-theme";

export default function ApprovalScreen() {
  const { colors } = useAppTheme();
  const { signOut, signOutError } = useSession();

  return (
    <AppScreen>
      <View style={styles.content}>
        <BrandMark />
        <View style={styles.body}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            Thanks for registering
          </Text>
          <Text style={[styles.message, { color: colors.mutedText }]}>
            Your player account is being reviewed. Once it’s approved, sign in
            on the eCricketCoach website with the same account.
          </Text>
        </View>
        {signOutError ? (
          <Text accessibilityLiveRegion="assertive" style={[styles.error, { color: colors.error }]}>
            {signOutError}
          </Text>
        ) : null}
        <AppButton onPress={() => void signOut()} variant="secondary">
          Sign out
        </AppButton>
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
