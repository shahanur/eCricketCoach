import { StyleSheet, Text, View } from "react-native";

import { ApiError, getUserFacingErrorMessage } from "../../api/api-error";
import { AppIcon } from "../../components/ui/app-icon";
import { StatusBadge } from "../../components/ui/player-card";
import { ScreenHeading } from "../../components/ui/screen-heading";
import { FeedbackScreen } from "../../components/feedback/feedback-screen";
import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { useSession } from "../../session/session-context";
import { useAppTheme } from "../../theme/use-app-theme";
import { OpenWebAppButton } from "../web-app/open-web-app-button";
import type { SubscriptionState } from "./use-subscription";
import { useSubscription } from "./use-subscription";

type Props = {
  state: SubscriptionState;
  onRetry: () => void;
  onSignOut: () => void;
  signOutError: string | null;
  profile?: boolean;
};

export function SubscriptionContent({ state, onRetry, onSignOut, signOutError, profile = false }: Props) {
  const { colors } = useAppTheme();
  if (state.status === "loading") {
    return <FeedbackScreen variant="loading" title="Loading your plan" message="Just a moment." />;
  }
  if (state.status === "error") {
    const expiredSession = state.error instanceof ApiError && state.error.status === 401;
    return (
      <View style={styles.content}>
        <FeedbackScreen
          variant="error"
          title={expiredSession ? "Please sign in again" : "We couldn't load your plan"}
          message={getUserFacingErrorMessage(state.error)}
          onRetry={expiredSession ? onSignOut : onRetry}
          retryLabel={expiredSession ? "Sign in again" : "Try again"}
        />
        {signOutError ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{signOutError}</Text> : null}
      </View>
    );
  }
  const { subscription } = state;
  const active = subscription.status === "ACTIVE";
  const expired = subscription.status === "EXPIRED";
  return (
    <View style={styles.content}>
      <ScreenHeading title={profile ? "Your account" : "Subscription"} backTo="/(app)/(tabs)/profile" />
      <Text style={[styles.body, { color: colors.mutedText }]}>
        {active ? "Welcome to your personal cricket training space." : "Your account is ready. Review your plan below."}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppIcon name="award" color={colors.gold} size={32} />
        <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>{subscription.plan.name}</Text>
        <StatusBadge label={active ? "Active" : expired ? "Expired" : "Not active"} />
        <Text style={[styles.body, { color: colors.mutedText }]}>
          {active ? "Your registration has been approved. Your plan covers one player." :
            expired ? "Your month of access has ended. Contact eCricketCoach to renew your plan." :
              "Contact eCricketCoach to review access to your Individual Player plan."}
        </Text>
        {subscription.period ? (
          <Text style={[styles.body, { color: colors.mutedText }]}>
            {active ? "Access until " : "Access ended "}
            {new Date(subscription.period.endsAt).toLocaleString()}
            {". This plan does not renew automatically."}
          </Text>
        ) : null}
        <Text style={[styles.body, { color: colors.mutedText }]}>
          Monthly plan allowance: {subscription.plan.monthlyAnalysisLimit} AI video actions.
          {" Analysis and usage tracking are not available in this release."}
        </Text>
      </View>
      <Text style={[styles.body, { color: colors.mutedText }]}>
        Video analysis and guided training will be available in a future release.
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Manage your membership</Text>
        <Text style={[styles.body, { color: colors.mutedText }]}>Visit eCricketCoach to review your membership. Purchase, payment-method changes and invoice history are not available in this app.</Text>
      <OpenWebAppButton label="Visit eCricketCoach" variant="secondary" />
      </View>
      <AppButton onPress={onRetry} variant="secondary">Refresh plan</AppButton>
      {signOutError ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{signOutError}</Text> : null}
      <AppButton onPress={onSignOut} variant="secondary">Sign out</AppButton>
    </View>
  );
}

export function SubscriptionScreen({ profile = false }: { profile?: boolean }) {
  const { state, retry } = useSubscription();
  const { signOut, signOutError } = useSession();
  return (
    <AppScreen>
      <SubscriptionContent state={state} onRetry={retry} onSignOut={() => void signOut()} signOutError={signOutError} profile={profile} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, gap: 20, paddingVertical: 16 },
  title: { fontSize: 30, fontWeight: "800" },
  heading: { fontSize: 21, fontWeight: "700" },
  status: { fontSize: 17, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 24 },
  card: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 12 },
});
