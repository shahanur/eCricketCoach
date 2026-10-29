import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon, type AppIconName } from "../../components/ui/app-icon";
import { useAppTheme } from "../../theme/use-app-theme";
import type { PlayerDashboard } from "../dashboard/dashboard-api";
import type { DashboardSection } from "../dashboard/use-dashboard";
import { getUserFacingErrorMessage } from "../../api/api-error";
import type { PlayerProfile } from "./player-profile-api";

const referenceStats = [
  { label: "Videos Analyzed", value: "22", icon: "video", color: "#FF565E" },
  { label: "Avg Technique Score", value: "78", icon: "progress", color: "#37B4F1" },
  { label: "Drills Completed", value: "12", icon: "list", color: "#48E58C" },
  { label: "Certificates", value: "3", icon: "trophy", color: "#FFD34D" },
] as const satisfies readonly { label: string; value: string; icon: AppIconName; color: string }[];

export function ProfileOverview({ profile, overview, onEdit, onRetry }: {
  profile: PlayerProfile;
  overview: DashboardSection<PlayerDashboard>;
  onEdit: () => void;
  onRetry: () => void;
}) {
  const { colors } = useAppTheme();
  const showReference = __DEV__ && overview.status === "ready" && overview.data.source === "DEVELOPMENT_SEED";
  const stage = showReference && overview.status === "ready" ? overview.data.progress?.stage : null;

  return <View style={styles.content}>
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={[styles.headingText, { color: colors.text }]}>Your Player Profile</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        onPress={() => router.navigate("/(app)/settings")}
        style={styles.settings}
        hitSlop={4}
      >
        <AppIcon name="settings" color={colors.text} size={24} />
      </Pressable>
    </View>

    <View style={styles.identity}>
      <View style={styles.avatarArea}>
        <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
          {showReference ? <Image
            source={require("../../../assets/practice-batting.png")}
            resizeMode="cover"
            style={styles.portrait}
            accessibilityLabel="Cricket player profile illustration"
          /> : <AppIcon name="profile" color={colors.primary} size={54} />}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit player details"
          accessibilityHint="Open your player profile editor"
          onPress={onEdit}
          style={[styles.camera, { backgroundColor: colors.surface, borderColor: colors.background }]}
          hitSlop={8}
        >
          <AppIcon name="camera" color={colors.text} size={17} />
        </Pressable>
      </View>
      <Text style={[styles.name, { color: colors.text }]}>{profile.displayName}</Text>
      <Text style={[styles.persona, { color: colors.mutedText }]}>Individual Player</Text>
    </View>

    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Current Stage, ${stage ?? "Not yet assessed"}, view progress`}
      onPress={() => router.navigate("/(app)/(tabs)/progress")}
      style={({ pressed }) => [styles.stage, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={[styles.stageIcon, { backgroundColor: `${colors.gold}20` }]}>
        <AppIcon name="crown" color="#FFD34D" size={27} />
      </View>
      <View style={styles.stageCopy}>
        <Text style={[styles.stageCaption, { color: colors.mutedText }]}>Current Stage</Text>
        <Text style={[styles.stageName, { color: colors.text }]}>{stage ?? "Not yet assessed"}</Text>
      </View>
      <AppIcon name="arrow" color={colors.text} size={18} />
    </Pressable>

    <View style={styles.statsSection}>
      <Text accessibilityRole="header" style={[styles.statsHeading, { color: colors.text }]}>Quick Stats</Text>
      <View style={styles.statsGrid}>
        {[0, 1].map((row) => <View key={row} style={styles.statsRow}>
          {referenceStats.slice(row * 2, row * 2 + 2).map(({ label, value, icon, color }) => <View
            key={label}
            accessible
            accessibilityLabel={`${label}: ${showReference ? value : "Not yet available"}`}
            style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
              <AppIcon name={icon} color={color} size={26} />
            </View>
            <View style={styles.statCopy}>
              <Text style={[styles.statValue, { color: colors.text }]}>{showReference ? value : "\u2014"}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedText }]}>{label}</Text>
            </View>
          </View>)}
        </View>)}
      </View>
    </View>

    {overview.status === "loading" ? <Text accessibilityLiveRegion="polite" style={[styles.notice, { color: colors.mutedText }]}>Loading your stats...</Text> : null}
    {overview.status === "error" ? <View style={styles.noticeRow}>
      <Text accessibilityRole="alert" style={[styles.notice, { color: colors.error }]}>{getUserFacingErrorMessage(overview.error)}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
        <Text style={{ color: colors.primary }}>Retry stats</Text>
      </Pressable>
    </View> : null}
    <Pressable
      accessibilityRole="button"
      onPress={onEdit}
      style={({ pressed }) => [styles.editButton, { backgroundColor: colors.accent, opacity: pressed ? 0.75 : 1 }]}
    >
      <Text style={[styles.editLabel, { color: colors.onAccent }]}>Edit Profile</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 4 },
  heading: { minHeight: 40, justifyContent: "center", paddingHorizontal: 35 },
  headingText: { fontSize: 21, lineHeight: 26, fontWeight: "700", textAlign: "center" },
  settings: { position: "absolute", right: -4, top: -2, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  identity: { alignItems: "center", gap: 2 },
  avatarArea: { width: 106, height: 106, marginBottom: 3 },
  avatar: { width: 106, height: 106, borderRadius: 53, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  portrait: { width: 170, height: 148, position: "absolute", left: -40, top: -18 },
  camera: { position: "absolute", right: -3, bottom: 1, width: 33, height: 33, borderRadius: 17, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 23, lineHeight: 27, fontWeight: "700", textAlign: "center" },
  persona: { fontSize: 13, lineHeight: 18 },
  stage: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9, minHeight: 60, borderWidth: 1, borderRadius: 13 },
  stageIcon: { width: 35, height: 35, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  stageCopy: { flex: 1, gap: 2 },
  stageCaption: { fontSize: 11, lineHeight: 15 },
  stageName: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  statsSection: { gap: 8 },
  statsHeading: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  statsGrid: { gap: 8 },
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: { flex: 1, minWidth: 0, minHeight: 60, borderWidth: 1, borderRadius: 13, flexDirection: "row", alignItems: "center", padding: 8, gap: 8 },
  statIcon: { width: 38, height: 38, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  statCopy: { flex: 1, gap: 1 },
  statValue: { fontSize: 18, lineHeight: 21, fontWeight: "600" },
  statLabel: { fontSize: 10, lineHeight: 13 },
  editButton: { minHeight: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", padding: 10 },
  editLabel: { fontSize: 15, fontWeight: "700" },
  noticeRow: { gap: 4 },
  notice: { fontSize: 12, lineHeight: 17 },
  retry: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
});
