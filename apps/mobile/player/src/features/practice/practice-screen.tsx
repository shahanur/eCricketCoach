import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { ApiError, getUserFacingErrorMessage } from "../../api/api-error";
import { FeedbackScreen } from "../../components/feedback/feedback-screen";
import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { AppIcon } from "../../components/ui/app-icon";
import { useSession } from "../../session/session-context";
import { useAppTheme } from "../../theme/use-app-theme";
import type { PlayerDashboard } from "../dashboard/dashboard-api";
import { useDashboard, type DashboardSection } from "../dashboard/use-dashboard";

const disciplines = [
  { title: "Batting", image: require("../../../assets/practice-batting.png"), color: "#FFD34D", detail: "Build balance, timing and a confident technique." },
  { title: "Bowling", image: require("../../../assets/practice-bowling.png"), color: "#FF565E", detail: "Focus on your approach, action and consistency." },
  { title: "Keeping", image: require("../../../assets/practice-keeping.png"), color: "#37B4F1", detail: "Develop your stance, footwork and glove work." },
  { title: "Fielding", image: require("../../../assets/practice-fielding.png"), color: "#48E58C", detail: "Work on movement, catching and throwing." },
] as const;

export function PracticeContent({ overview, onRetry }: {
  overview: DashboardSection<PlayerDashboard>;
  onRetry: () => void;
}) {
  const { colors } = useAppTheme();
  const [detail, setDetail] = useState<{ title: string; description: string } | null>(null);
  // This artwork-only recommendation is an explicit fixture, never a production fallback.
  const showReferenceDrill = __DEV__ && overview.status === "ready" && overview.data.source === "DEVELOPMENT_SEED";
  return <>
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Practice</Text>
      <Text style={[styles.subtitle, { color: colors.text }]}>Choose a discipline to start your session.</Text>
    </View>
    <View style={styles.grid}>
      {disciplines.map(({ title, image, color, detail: description }) => <Pressable
        key={title}
        accessibilityRole="button"
        accessibilityLabel={`Explore ${title.toLowerCase()}`}
        onPress={() => setDetail({ title: `${title} practice`, description })}
        style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
      >
        <Image source={image} resizeMode="cover" style={styles.photo} />
        <View style={styles.photoShade} />
        <View style={styles.tileFooter}>
          <Text style={styles.tileTitle}>{title}</Text>
          <View style={[styles.arrowCircle, { backgroundColor: color }]}>
            <View style={styles.arrowShaft} />
            <AppIcon name="arrow" color="#102A1D" size={22} />
          </View>
        </View>
      </Pressable>)}
    </View>
    <View style={[styles.recommendation, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.recommendationHeading}>
        <AppIcon name="bulb" color={colors.gold} size={24} />
        <Text accessibilityRole="header" style={[styles.recommendationTitle, { color: colors.text }]}>Recommended for you</Text>
      </View>
      {showReferenceDrill ? <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back Foot Defence Drill, Improve balance and timing"
          onPress={() => setDetail({ title: "Back Foot Defence Drill", description: "Improve balance and timing. This is a sample drill, not a personal assessment." })}
          style={({ pressed }) => [styles.drill, { opacity: pressed ? 0.75 : 1 }]}
        >
          <Image
            accessible accessibilityRole="image" accessibilityLabel="Batter practising back foot defence"
            source={require("../../../assets/practice-defence.png")} style={styles.thumbnail}
          />
          <View style={styles.drillCopy}>
            <Text style={[styles.drillTitle, { color: colors.text }]}>Back Foot Defence Drill</Text>
            <Text style={[styles.drillSubtitle, { color: colors.mutedText }]}>Improve balance and timing</Text>
          </View>
          <AppIcon name="arrow" color={colors.mutedText} size={20} />
        </Pressable>
        <Text style={[styles.sample, { color: colors.mutedText }]}>Demo data</Text>
      </> : overview.status === "loading" ? (
        <ActivityIndicator accessibilityLabel="Loading practice recommendations" color={colors.primary} />
      ) : overview.status === "error" ? (
        <View style={styles.notice}>
          <Text accessibilityRole="alert" style={[styles.body, { color: colors.error }]}>{getUserFacingErrorMessage(overview.error)}</Text>
          <AppButton variant="secondary" onPress={onRetry}>Retry recommendations</AppButton>
        </View>
      ) : <Text style={[styles.body, { color: colors.mutedText }]}>Your recommended drills will appear here when available. Explore a discipline to find your focus.</Text>}
    </View>
    {detail ? <Modal transparent animationType="fade" onRequestClose={() => setDetail(null)}>
      <View style={styles.modalBackdrop}>
        <View accessibilityViewIsModal style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <Text accessibilityRole="header" style={[styles.detailTitle, { color: colors.text }]}>{detail.title}</Text>
          <Text style={[styles.body, { color: colors.mutedText }]}>{detail.description}</Text>
          <Text style={[styles.body, { color: colors.mutedText }]}>Guided drills and practice logging are coming soon. You can set your training goals in your profile today.</Text>
          <AppButton onPress={() => {
            setDetail(null);
            router.navigate("/(app)/(tabs)/profile");
          }}>Review training goals</AppButton>
          <AppButton variant="secondary" onPress={() => setDetail(null)}>Close</AppButton>
        </View>
      </View>
    </Modal> : null}
  </>;
}

export function PracticeScreen() {
  const dashboard = useDashboard();
  const { signOut, signOutError } = useSession();
  const { colors } = useAppTheme();
  const accessError = [dashboard.profile, dashboard.subscription, dashboard.overview].find(
    (section) => section.status === "error" && section.error instanceof ApiError &&
      (section.error.status === 401 || section.error.status === 403),
  );
  if (accessError?.status === "error") return <>
    <FeedbackScreen
      variant="error"
      title={accessError.error instanceof ApiError && accessError.error.status === 401 ? "Please sign in again" : "Your access needs a review"}
      message={getUserFacingErrorMessage(accessError.error)}
      onRetry={() => { void signOut(); }}
      retryLabel="Sign out"
    />
    {signOutError ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{signOutError}</Text> : null}
  </>;
  return <AppScreen refreshControl={<RefreshControl refreshing={dashboard.refreshing} onRefresh={dashboard.refresh} tintColor={colors.primary} />}>
    <PracticeContent overview={dashboard.overview} onRetry={dashboard.refreshOverview} />
  </AppScreen>;
}

const styles = StyleSheet.create({
  heading: { gap: 5, marginTop: 16, marginBottom: 8 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "700" },
  subtitle: { fontSize: 15, lineHeight: 22 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  tile: { flexBasis: "45%", flexGrow: 1, aspectRatio: 0.87, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  photo: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  photoShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 48, backgroundColor: "rgba(0, 0, 0, 0.52)" },
  tileFooter: { position: "absolute", bottom: 4, left: 10, right: 2, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 2 },
  tileTitle: { fontSize: 18, fontWeight: "600", color: "#FFFFFF", flexShrink: 1 },
  arrowCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  arrowShaft: { width: 16, height: 1.8, backgroundColor: "#102A1D", position: "absolute", left: 12 },
  recommendation: { padding: 12, borderWidth: 1, borderRadius: 14, gap: 12, marginTop: 4 },
  recommendationHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  recommendationTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "600", flexShrink: 1 },
  drill: { flexDirection: "row", gap: 12, alignItems: "center", minHeight: 72 },
  thumbnail: { width: 76, height: 76, borderRadius: 8 },
  drillCopy: { flex: 1, gap: 6 },
  drillTitle: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  drillSubtitle: { fontSize: 12, lineHeight: 18 },
  sample: { fontSize: 11 },
  notice: { gap: 12 },
  body: { fontSize: 15, lineHeight: 23 },
  modalBackdrop: { flex: 1, padding: 24, backgroundColor: "rgba(0, 0, 0, 0.6)", justifyContent: "center", alignItems: "center" },
  modalCard: { width: "100%", maxWidth: 480, padding: 24, borderRadius: 22, gap: 16 },
  detailTitle: { fontSize: 23, fontWeight: "700" },
});
