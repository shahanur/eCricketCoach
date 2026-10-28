import { StyleSheet, Text, View } from "react-native";

import { BrandMark } from "../../components/brand/brand-mark";
import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { AppIcon } from "../../components/ui/app-icon";
import { StatusBadge } from "../../components/ui/player-card";
import { OpenWebAppButton } from "../../features/web-app/open-web-app-button";
import { useSession } from "../../session/session-context";
import { useAppTheme } from "../../theme/use-app-theme";

export default function AccessUnavailableScreen() {
  const { colors } = useAppTheme();
  const { state, signOut, signOutError } = useSession();
  const differentAccount = state.status === "active" && state.accessReason === "ACCOUNT_TYPE_MISMATCH";

  return (
    <AppScreen>
      <View style={styles.content}>
        <BrandMark />
        <View style={styles.body}>
          <View style={[styles.symbol, { backgroundColor: colors.secondary }]}>
            <AppIcon name="profile" color={colors.primary} size={36} />
          </View>
          <StatusBadge label={differentAccount ? "Choose another account" : "Your player membership"} />
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            {differentAccount ? "Use your player account" : "Player access unavailable"}
          </Text>
          <Text style={[styles.message, { color: colors.mutedText }]}>
            {differentAccount
              ? "You’re signed in with an administrator or club account. Sign out and choose the Google account linked to your approved Individual Player registration."
              : "We couldn’t confirm Individual Player access for this account. Sign in with the Google account used for your approved player registration, or visit the eCricketCoach website to review your access."}
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
  symbol: { width: 76, height: 76, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 8 },
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
