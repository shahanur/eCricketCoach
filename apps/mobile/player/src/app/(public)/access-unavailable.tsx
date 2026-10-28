import { StyleSheet, Text, View } from "react-native";

import { BrandMark } from "../../components/brand/brand-mark";
import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { OpenWebAppButton } from "../../features/web-app/open-web-app-button";
import { useSession } from "../../session/session-context";
import { useAppTheme } from "../../theme/use-app-theme";

export default function AccessUnavailableScreen() {
  const { colors } = useAppTheme();
  const { signOut, signOutError } = useSession();

  return (
    <AppScreen>
      <View style={styles.content}>
        <BrandMark />
        <View style={styles.body}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            Your plan isn’t active
          </Text>
          <Text style={[styles.message, { color: colors.mutedText }]}>
            This account doesn’t currently have an active Individual Player
            plan. Visit the eCricketCoach website to choose or renew your plan.
          </Text>
        </View>
        <View style={styles.actions}>
          <OpenWebAppButton label="Manage my plan" />
          {signOutError ? (
            <Text accessibilityLiveRegion="assertive" style={[styles.error, { color: colors.error }]}>
              {signOutError}
            </Text>
          ) : null}
          <AppButton onPress={() => void signOut()} variant="secondary">
            Sign out
          </AppButton>
        </View>
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
  actions: {
    gap: 12,
  },
  error: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
});
