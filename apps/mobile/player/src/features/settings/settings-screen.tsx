import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { AppIcon } from "../../components/ui/app-icon";
import { PlayerCard, StatusBadge } from "../../components/ui/player-card";
import { ScreenHeading } from "../../components/ui/screen-heading";
import { useSession } from "../../session/session-context";
import { useAppTheme } from "../../theme/use-app-theme";
import { OpenWebAppButton } from "../web-app/open-web-app-button";

export function SettingsScreen() {
  const { colors, mode } = useAppTheme();
  const { state, signOut, signOutError } = useSession();
  return <AppScreen>
    <ScreenHeading title="Settings" backTo="/(app)/(tabs)/profile" />
    <PlayerCard title="Your account">
      <View style={styles.row}>
        <AppIcon name="profile" color={colors.primary} />
        <Text style={[styles.body, { color: colors.text, flex: 1 }]}>{state.status === "active" ? state.email : "Your player account"}</Text>
      </View>
      <AppButton variant="secondary" onPress={() => router.navigate("/(app)/(tabs)/profile")}>Personal information</AppButton>
      <AppButton variant="secondary" onPress={() => router.navigate("/(app)/subscription")}>Manage subscription</AppButton>
      <Text style={[styles.body, { color: colors.mutedText }]}>Your Google account manages your sign-in details. There is no separate eCricketCoach password.</Text>
    </PlayerCard>
    <PlayerCard title="Appearance">
      <StatusBadge label={`System theme: ${mode === "dark" ? "Dark" : "Light"}`} />
      <Text style={[styles.body, { color: colors.mutedText }]}>The app follows your device appearance automatically. Change your phone&apos;s display settings to switch between light and dark.</Text>
    </PlayerCard>
    <PlayerCard title="Your privacy">
      <Text style={[styles.body, { color: colors.mutedText }]}>Your player profile and personal goals belong to your account. Signing out removes your saved session and clears this app&apos;s temporary player data.</Text>
    </PlayerCard>
    <PlayerCard title="Connected services">
      <StatusBadge label="Coming soon" />
      <Text style={[styles.body, { color: colors.mutedText }]}>Google Drive sync, notification preferences and biometric unlock are not available in this release.</Text>
    </PlayerCard>
    <PlayerCard title="eCricketCoach">
      <Text style={[styles.body, { color: colors.mutedText }]}>Visit our website to review your membership and learn more about eCricketCoach.</Text>
      <OpenWebAppButton label="Visit eCricketCoach" variant="secondary" />
    </PlayerCard>
    {signOutError ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{signOutError}</Text> : null}
    <AppButton variant="secondary" onPress={() => void signOut()}>Sign out</AppButton>
  </AppScreen>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  body: { fontSize: 15, lineHeight: 23 },
});
