import { router } from "expo-router";
import { useEffect, useState, type PropsWithChildren, type ReactNode } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { ApiError, getUserFacingErrorMessage } from "../../api/api-error";
import { BrandMark } from "../../components/brand/brand-mark";
import { FeedbackScreen } from "../../components/feedback/feedback-screen";
import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { AppIcon, type AppIconName } from "../../components/ui/app-icon";
import { PlayerCard, StatusBadge } from "../../components/ui/player-card";
import { useSession } from "../../session/session-context";
import { useAppTheme } from "../../theme/use-app-theme";
import type { PlayerProfile } from "../profile/player-profile-api";
import type { PlayerSubscription } from "../subscription/subscription-api";
import { useDashboard, type DashboardSection } from "./use-dashboard";

const disciplines = [
  ["BATTING", "Batting"],
  ["BOWLING", "Bowling"],
  ["KEEPING", "Wicketkeeping"],
  ["FIELDING", "Fielding"],
] as const;

function Card({ title, children }: PropsWithChildren<{ title: string }>) {
  return <PlayerCard title={title}>{children}</PlayerCard>;
}

function Copy({ children }: PropsWithChildren) {
  const { colors } = useAppTheme();
  return <Text style={[styles.body, { color: colors.mutedText }]}>{children}</Text>;
}

function QuickAction({ label, icon, onPress, disabled = false }: {
  label: string; icon: AppIconName; onPress?: () => void; disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.quickAction, {
      backgroundColor: colors.surface, borderColor: colors.border, opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
    }]}
  >
    <View style={[styles.quickIcon, { backgroundColor: colors.secondary }]}><AppIcon name={icon} color={colors.primary} size={22} /></View>
    <Text style={[styles.quickLabel, { color: colors.text }]}>{label}</Text>
  </Pressable>;
}

function Section<T>({
  title, section, onRetry, children,
}: {
  title: string;
  section: DashboardSection<T>;
  onRetry: () => void;
  children: (data: T) => ReactNode;
}) {
  const { colors } = useAppTheme();
  const snapshot = section.status === "ready" ? section : section.status === "error" ? section.cached : undefined;
  return (
    <Card title={title}>
      {section.status === "loading" ? <Copy>Loading {title.toLowerCase()}...</Copy> : null}
      {section.status === "error" ? (
        <>
          <Text accessibilityRole="alert" style={[styles.body, { color: colors.error }]}>
            {getUserFacingErrorMessage(section.error)}
          </Text>
          {snapshot ? (
            <Copy>Showing saved details from {new Date(snapshot.updatedAt).toLocaleString()}. These may be out of date.</Copy>
          ) : <Copy>We couldn&apos;t load {title.toLowerCase()}.</Copy>}
          <AppButton onPress={onRetry} variant="secondary">Retry {title.toLowerCase()}</AppButton>
        </>
      ) : null}
      {snapshot ? children(snapshot.data) : null}
    </Card>
  );
}

function PlanDetails({ plan }: { plan: PlayerSubscription }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (plan.status !== "ACTIVE" || !plan.period) return;
    const end = Date.parse(plan.period.endsAt);
    if (end <= now) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, Math.min(end - Date.now(), 86_400_000)));
    return () => clearTimeout(timer);
  }, [plan, now]);
  const expired = plan.status === "EXPIRED" ||
    (plan.status === "ACTIVE" && !!plan.period && Date.parse(plan.period.endsAt) <= now);
  const active = plan.status === "ACTIVE" && !expired;
  const unavailable = plan.status === "UNAVAILABLE";
  return (
    <>
      <StatusBadge label={`${plan.plan.name}: ${active ? "Active" : expired ? "Expired" : unavailable ? "Unavailable" : "Not active"}`} />
      <Copy>
        {active ? `Your approved access covers ${plan.plan.profileLimit} player profile.` :
          expired ? "Your access has ended. Visit your profile for renewal guidance." :
            unavailable ? "Plan access is unavailable. Visit your profile to review your options." :
              "Your plan is not active. Visit your profile to review your access."}
      </Copy>
      {plan.period ? (
        <Copy>
          {expired ? "Access ended " : "Access until "}{new Date(plan.period.endsAt).toLocaleString()}.
          {" This plan does not renew automatically."}
        </Copy>
      ) : null}
      <Copy>Monthly AI allowance: {plan.plan.monthlyAnalysisLimit} video actions in the Individual Player plan.</Copy>
      <Copy>
        AI analysis is not available in this release. Usage, remaining actions and the next allowance reset are unavailable.
        {" Your access end date is not an allowance reset date."}
      </Copy>
    </>
  );
}

type Props = {
  profile: DashboardSection<PlayerProfile>;
  subscription: DashboardSection<PlayerSubscription>;
  onRefreshProfile: () => void;
  onRefreshSubscription: () => void;
  onSignOut: () => void;
  signOutError: string | null;
};

export function DashboardContent({
  profile, subscription, onRefreshProfile, onRefreshSubscription, onSignOut, signOutError,
}: Props) {
  const { colors } = useAppTheme();
  const accessError = [profile, subscription].find(
    (section) => section.status === "error" && section.error instanceof ApiError &&
      (section.error.status === 401 || section.error.status === 403),
  );
  if (accessError?.status === "error") {
    const ended = accessError.error instanceof ApiError && accessError.error.status === 401;
    return (
      <>
        <FeedbackScreen
          variant="error"
          title={ended ? "Please sign in again" : "Your access needs a review"}
          message={getUserFacingErrorMessage(accessError.error)}
          onRetry={onSignOut}
          retryLabel={ended ? "Sign in again" : "Return to sign in"}
        />
        {signOutError ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{signOutError}</Text> : null}
      </>
    );
  }
  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <BrandMark />
        <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.navigate("/(app)/settings")} style={[styles.settings, { backgroundColor: colors.secondary }]}>
          <AppIcon name="settings" color={colors.primary} size={20} />
        </Pressable>
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Your performance</Text>
      <Copy>Your personal cricket journey, one step at a time.</Copy>
      <Section title="Your player profile" section={profile} onRetry={onRefreshProfile}>
        {(player) => (
          <>
            <StatusBadge label="Welcome back" />
            <Text style={[styles.heading, { color: colors.text }]}>{player.displayName}</Text>
            <Copy>
              {player.isComplete ? "Your training preferences are saved." :
                "Start your journey by choosing your cricket disciplines and adding a training goal."}
            </Copy>
            <Text style={[styles.label, { color: colors.text }]}>Your current goals</Text>
            {player.goals.length ? player.goals.map((goal, index) => <Copy key={index}>{goal}</Copy>) :
              <Copy>No goals added yet. Set a goal in your profile to give your training a focus.</Copy>}
            <Text style={[styles.label, { color: colors.text }]}>Your disciplines</Text>
            <View style={styles.disciplineGrid}>{disciplines.map(([value, label]) => (
              <View key={value} style={[styles.discipline, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <AppIcon name={value === "BATTING" ? "practice" : value === "BOWLING" ? "analyze" : value === "KEEPING" ? "profile" : "practice"} color={colors.primary} size={20} />
                <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
                <Copy>{player.primaryDisciplines.includes(value) ? "Selected training focus" : "Not selected as a training focus"}</Copy>
                <Copy>Stage and progress: coming soon</Copy>
              </View>
            ))}</View>
            <AppButton onPress={() => router.navigate("/(app)/(tabs)/profile")}>
              {player.isComplete ? "Edit profile and goals" : "Complete your profile"}
            </AppButton>
          </>
        )}
      </Section>
      <Card title="Your next step">
        <Copy>Review your profile and goals today. Guided roadmaps and solo practice are coming soon.</Copy>
        <AppButton onPress={() => router.navigate("/(app)/(tabs)/profile")}>Review your profile</AppButton>
      </Card>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Quick actions</Text>
      <View style={styles.quickGrid}>
        <QuickAction icon="practice" label="Explore practice: Coming soon" onPress={() => router.navigate("/(app)/(tabs)/practice")} />
        <QuickAction icon="progress" label="View roadmap: Coming soon" onPress={() => router.navigate("/(app)/(tabs)/progress")} />
        <QuickAction icon="analyze" label="Record or upload: Coming soon" onPress={() => router.navigate("/(app)/(tabs)/analyze")} />
        <QuickAction icon="progress" label="Analysis history: Coming soon" disabled />
      </View>
      <Card title="Practice progress">
        <Copy>Practice tracking is coming soon. Session totals, training minutes and completion trends are not available yet.</Copy>
      </Card>
      <Card title="Recent analysis">
        <Copy>Video recording, uploads and AI feedback are coming soon. Analysis results and history are not available yet.</Copy>
      </Card>
      <Card title="Milestones and certificates">
        <Copy>Milestones and certificates are coming soon. Keep your goals up to date as you prepare for your next stage.</Copy>
      </Card>
      <Section title="Your plan and allowance" section={subscription} onRetry={onRefreshSubscription}>
        {(plan) => <PlanDetails plan={plan} />}
      </Section>
      <AppButton variant="secondary" onPress={() => router.navigate("/(app)/(tabs)/profile")}>Manage profile and plan</AppButton>
    </View>
  );
}

export function DashboardScreen() {
  const dashboard = useDashboard();
  const { signOut, signOutError } = useSession();
  const { colors } = useAppTheme();
  return (
    <AppScreen refreshControl={
      <RefreshControl
        refreshing={dashboard.refreshing}
        onRefresh={dashboard.refresh}
        tintColor={colors.primary}
        colors={[colors.primary]}
      />
    }>
      <DashboardContent
        profile={dashboard.profile}
        subscription={dashboard.subscription}
        onRefreshProfile={dashboard.refreshProfile}
        onRefreshSubscription={dashboard.refreshSubscription}
        onSignOut={() => void signOut()}
        signOutError={signOutError}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingVertical: 8 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 },
  settings: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.8 },
  heading: { fontSize: 21, fontWeight: "700", letterSpacing: -0.4 },
  label: { fontSize: 15, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 23 },
  disciplineGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  discipline: { flexBasis: "45%", flexGrow: 1, gap: 6, padding: 12, borderWidth: 1, borderRadius: 12 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickAction: { flexBasis: "45%", flexGrow: 1, gap: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
  quickIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 13, fontWeight: "600", lineHeight: 19 },
});
