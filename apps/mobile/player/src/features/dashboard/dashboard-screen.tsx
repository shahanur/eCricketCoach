import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Image, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { ApiError, getUserFacingErrorMessage } from "../../api/api-error";
import { BrandMark } from "../../components/brand/brand-mark";
import { FeedbackScreen } from "../../components/feedback/feedback-screen";
import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { AppIcon } from "../../components/ui/app-icon";
import { useSession } from "../../session/session-context";
import { useAppTheme } from "../../theme/use-app-theme";
import type { PlayerProfile } from "../profile/player-profile-api";
import type { PlayerSubscription } from "../subscription/subscription-api";
import type { PlayerDashboard } from "./dashboard-api";
import { useDashboard, type DashboardSection } from "./use-dashboard";

function snapshot<T>(section: DashboardSection<T>) {
  return section.status === "ready" ? section : section.status === "error" ? section.cached : undefined;
}

function SectionNotice({ section, label, onRetry }: {
  section: DashboardSection<unknown>; label: string; onRetry: () => void;
}) {
  const { colors } = useAppTheme();
  if (section.status !== "error") return null;
  return <View style={styles.notice}>
    <Text accessibilityRole="alert" style={[styles.body, { color: colors.error }]}>
      {getUserFacingErrorMessage(section.error)}
    </Text>
    {section.cached ? <Text style={{ color: colors.mutedText }}>
      Showing saved details from {new Date(section.cached.updatedAt).toLocaleString()}. These may be out of date.
    </Text> : null}
    <AppButton variant="secondary" onPress={onRetry}>Retry {label}</AppButton>
  </View>;
}

function ProgressRing({ percent }: { percent: number | null }) {
  const { colors } = useAppTheme();
  return <View
    accessible accessibilityRole="progressbar"
    accessibilityLabel={percent === null ? "Progress not yet assessed" : "Current stage progress"}
    accessibilityValue={percent === null ? { text: "Not yet assessed" } : { min: 0, max: 100, now: percent }}
    style={styles.ring}
  >
    <View style={[styles.ringTrack, { borderColor: colors.secondary }]} />
    {Array.from({ length: percent ?? 0 }, (_, index) => <View key={index} style={[
      styles.ringSegment, { backgroundColor: colors.primary, transform: [{ rotate: `${index * 3.6}deg` }, { translateY: -41 }] },
    ]} />)}
    <Text style={[styles.percent, { color: colors.text }]}>{percent === null ? "\u2014" : `${percent}%`}</Text>
  </View>;
}

function DetailModal({ title, children, onClose }: {
  title: string; children: ReactNode; onClose: () => void;
}) {
  const { colors } = useAppTheme();
  return <Modal transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <View accessibilityViewIsModal style={[styles.modalCard, { backgroundColor: colors.surface }]}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        {children}
        <AppButton variant="secondary" onPress={onClose}>Close</AppButton>
      </View>
    </View>
  </Modal>;
}

type Props = {
  profile: DashboardSection<PlayerProfile>;
  subscription: DashboardSection<PlayerSubscription>;
  overview: DashboardSection<PlayerDashboard>;
  onRefreshProfile: () => void;
  onRefreshSubscription: () => void;
  onRefreshOverview: () => void;
  onSignOut: () => void;
  signOutError: string | null;
};

export function DashboardContent({
  profile, subscription, overview, onRefreshProfile, onRefreshSubscription, onRefreshOverview, onSignOut, signOutError,
}: Props) {
  const { colors } = useAppTheme();
  const [detail, setDetail] = useState<"notifications" | "focus" | null>(null);
  const [readNotification, setReadNotification] = useState<string | null>(null);
  const player = snapshot(profile)?.data;
  const profileReady = !!player?.primaryDisciplines.length && player.experienceLevel !== "NOT_SET" && !!player.goals.length;
  const dashboard = snapshot(overview)?.data;
  const notification = dashboard?.notification;
  const unread = !!notification && readNotification !== notification;
  const accessError = [profile, subscription, overview].find(
    (section) => section.status === "error" && section.error instanceof ApiError &&
      (section.error.status === 401 || section.error.status === 403),
  );
  if (accessError?.status === "error") {
    const ended = accessError.error instanceof ApiError && accessError.error.status === 401;
    return <>
      <FeedbackScreen
        variant="error"
        title={ended ? "Please sign in again" : "Your access needs a review"}
        message={getUserFacingErrorMessage(accessError.error)}
        onRetry={onSignOut}
        retryLabel={ended ? "Sign in again" : "Return to sign in"}
      />
      {signOutError ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{signOutError}</Text> : null}
    </>;
  }
  const openPractice = () => router.navigate("/(app)/(tabs)/practice");
  return <View style={styles.content}>
    <View style={styles.topBar}>
      <BrandMark />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unread ? "Notifications, unread notification" : "Notifications"}
        onPress={() => { setReadNotification(notification ?? null); setDetail("notifications"); }}
        style={styles.notifications}
      >
        <AppIcon name="bell" color={colors.text} size={25} />
        {unread ? <View testID="notification-dot" style={styles.notificationDot} /> : null}
      </Pressable>
    </View>
    <View style={styles.greeting}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        Welcome back,{player ? `\n${player.displayName.split(/\s+/)[0]} \uD83D\uDC4B` : ""}
      </Text>
      {profile.status === "loading" ? <Text style={[styles.body, { color: colors.mutedText }]}>Loading your profile...</Text> : null}
      <Text style={[styles.body, { color: colors.text }]}>Build your game, one step at a time.</Text>
    </View>
    <SectionNotice section={profile} label="your player profile" onRetry={onRefreshProfile} />
    <SectionNotice section={overview} label="your dashboard" onRetry={onRefreshOverview} />
    <SectionNotice section={subscription} label="your plan" onRetry={onRefreshSubscription} />
    {profile.status === "ready" ? <View style={[styles.stageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.stageDetails}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>{profileReady ? "Next: your video baseline" : "First: your player profile"}</Text>
        <Text style={[styles.body, { color: colors.mutedText }]}>{profileReady
          ? "Your personal roadmap starts with verified video strengths and areas to improve. Video analysis is not available yet; provisional practice is still available."
          : "Choose your disciplines, experience level and goals to begin your journey."}</Text>
        <AppButton variant="secondary" onPress={() => router.navigate(profileReady ? "/(app)/(tabs)/analyze" : "/(app)/(tabs)/profile")}>
          {profileReady ? "About video baseline" : "Complete player profile"}
        </AppButton>
      </View>
    </View> : null}
    {dashboard?.source === "DEVELOPMENT_SEED" ? <Text
      style={[styles.demoLabel, { color: colors.mutedText }]}
    >Demo data · Sample stage and training focus</Text> : null}
    <View style={[styles.stageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ProgressRing percent={dashboard?.progress?.percent ?? null} />
      <View style={styles.stageDetails}>
        <Text style={[styles.stageCaption, { color: colors.mutedText }]}>Current Stage</Text>
        <Text style={[styles.stageName, { color: colors.text }]}>
          {overview.status === "loading" ? "Loading your stage..." : dashboard?.progress?.stage ?? "Not yet assessed"}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="View Roadmap" onPress={() => router.navigate("/(app)/(tabs)/progress")} style={styles.roadmap}>
          <Text style={[styles.link, { color: colors.primary }]}>View Roadmap</Text>
          <Text accessible={false} style={[styles.linkArrow, { color: colors.primary }]}>&rarr;</Text>
        </Pressable>
      </View>
    </View>
    <View style={styles.focusSection}>
      <View style={styles.sectionHeader}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>Today&apos;s Focus</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="See all practice drills" onPress={openPractice} style={styles.seeAll}>
          <Text style={[styles.link, { color: colors.primary }]}>See all</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dashboard?.focus ? `${dashboard.focus.title}, ${dashboard.focus.discipline}, ${dashboard.focus.minutes} minutes` : "Explore practice"}
        onPress={() => dashboard?.focus ? setDetail("focus") : openPractice()}
        style={({ pressed }) => [styles.focusCard, {
          backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.75 : 1,
        }]}
      >
        {dashboard?.focus ? <Image
          accessible accessibilityRole="image"
          accessibilityLabel="Batter practising a front foot drive"
          source={require("../../../assets/front-foot-drive.png")}
          style={styles.focusImage}
        /> : <View style={[styles.focusImage, styles.emptyImage, { backgroundColor: colors.secondary }]}>
          <AppIcon name="runner" color={colors.primary} size={32} />
        </View>}
        <View style={styles.focusText}>
          <Text style={[styles.focusTitle, { color: colors.text }]}>
            {overview.status === "loading" ? "Loading your focus..." : dashboard?.focus?.title ?? "Find your training focus"}
          </Text>
          <Text style={[styles.focusMeta, { color: colors.mutedText }]}>
            {dashboard?.focus ? `${dashboard.focus.discipline} \u00B7 ${dashboard.focus.minutes} min` : "Explore practice drills"}
          </Text>
        </View>
        <AppIcon name="arrow" color={colors.text} size={18} />
      </Pressable>
    </View>
    {detail === "notifications" ? <DetailModal title="Notifications" onClose={() => setDetail(null)}>
      <Text style={[styles.body, { color: colors.text }]}>{notification ?? "You're all caught up."}</Text>
      {notification ? <Text style={{ color: colors.mutedText }}>Demo notification</Text> : null}
    </DetailModal> : null}
    {detail === "focus" && dashboard?.focus ? <DetailModal title={dashboard.focus.title} onClose={() => setDetail(null)}>
      <Text style={[styles.body, { color: colors.mutedText }]}>{dashboard.focus.discipline} · {dashboard.focus.minutes} min · Demo data</Text>
      <Text style={[styles.body, { color: colors.text }]}>{dashboard.focus.description}</Text>
      <AppButton onPress={() => { setDetail(null); openPractice(); }}>Explore practice</AppButton>
    </DetailModal> : null}
  </View>;
}

export function DashboardScreen() {
  const dashboard = useDashboard();
  const { state, signOut, signOutError } = useSession();
  const { colors } = useAppTheme();
  return <AppScreen refreshControl={
    <RefreshControl refreshing={dashboard.refreshing} onRefresh={dashboard.refresh} tintColor={colors.primary} colors={[colors.primary]} />
  }>
    <DashboardContent
      key={state.status === "active" ? state.email : state.status}
      profile={dashboard.profile}
      subscription={dashboard.subscription}
      overview={dashboard.overview}
      onRefreshProfile={dashboard.refreshProfile}
      onRefreshSubscription={dashboard.refreshSubscription}
      onRefreshOverview={dashboard.refreshOverview}
      onSignOut={() => void signOut()}
      signOutError={signOutError}
    />
  </AppScreen>;
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingTop: 0, paddingBottom: 4 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  notifications: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  notificationDot: { position: "absolute", top: 7, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: "#F04452" },
  greeting: { gap: 8 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -0.5 },
  body: { fontSize: 16, lineHeight: 23 },
  demoLabel: { fontSize: 11, lineHeight: 15 },
  stageCard: { flexDirection: "row", alignItems: "center", gap: 16, borderRadius: 15, borderWidth: 1, padding: 14, minHeight: 124 },
  ring: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  ringTrack: { position: "absolute", width: 90, height: 90, borderWidth: 8, borderRadius: 45 },
  ringSegment: { position: "absolute", width: 3.5, height: 8, borderRadius: 4 },
  percent: { fontSize: 27, fontWeight: "700", letterSpacing: -0.8 },
  stageDetails: { flex: 1, gap: 5 },
  stageCaption: { fontSize: 14 },
  stageName: { fontSize: 18, fontWeight: "700", lineHeight: 24 },
  roadmap: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  link: { fontSize: 14, fontWeight: "600" },
  linkArrow: { fontSize: 23 },
  sectionTitle: { fontSize: 18, fontWeight: "700", lineHeight: 24 },
  focusSection: { gap: 4 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  seeAll: { minHeight: 44, minWidth: 48, alignItems: "flex-end", justifyContent: "center" },
  focusCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 9, borderRadius: 15, borderWidth: 1, minHeight: 94 },
  focusImage: { width: 82, height: 76, borderRadius: 9 },
  emptyImage: { alignItems: "center", justifyContent: "center" },
  focusText: { flex: 1, gap: 6 },
  focusTitle: { fontSize: 15, fontWeight: "600", lineHeight: 20 },
  focusMeta: { fontSize: 14, lineHeight: 19 },
  notice: { gap: 8 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", maxWidth: 480, alignSelf: "center", padding: 24, borderRadius: 20, gap: 16 },
});
