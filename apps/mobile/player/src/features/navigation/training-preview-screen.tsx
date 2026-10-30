import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { CricketArt } from "../../components/brand/cricket-art";
import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { AppIcon } from "../../components/ui/app-icon";
import { PlayerCard, StatusBadge } from "../../components/ui/player-card";
import { ScreenHeading } from "../../components/ui/screen-heading";
import { useAppTheme } from "../../theme/use-app-theme";

const analysisSections = [
  { title: "Analysis", heading: "See your technique differently", detail: "Video recording, uploads and personal feedback are coming soon. Your own clips and results will appear here when analysis is available." },
  { title: "Pose", heading: "Understand your movement", detail: "Pose feedback is coming soon. Movement overlays will be shown only when supported by your video analysis." },
  { title: "Metrics", heading: "Feedback you can trust", detail: "Technique metrics are coming soon. Scores and measurements will appear only when supported by your own analysis results." },
] as const;

const progressPeriods = ["4 Weeks", "3 Months", "All Time"] as const;

const referenceProgress = {
  change: 28,
  dates: ["10 Oct", "14 Oct", "18 Oct", "22 Oct", "28 Oct"],
  trend: [18, 22, 27, 32, 37, 42, 48, 54, 60, 67, 74, 82],
  disciplines: [
    { title: "Batting", score: 76, icon: "practice", color: "#F4CE63" },
    { title: "Bowling", score: 68, icon: "analyze", color: "#FF6969" },
    { title: "Keeping", score: 62, icon: "award", color: "#62B7F5" },
    { title: "Fielding", score: 70, icon: "runner", color: "#48E58C" },
  ],
} as const;

function ChoiceTabs({ options, selected, onSelect }: {
  options: readonly { title: string }[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const { colors } = useAppTheme();
  return <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    {options.map(({ title }, index) => <Pressable
      key={title}
      accessibilityRole="tab"
      accessibilityState={{ selected: selected === index }}
      onPress={() => onSelect(index)}
      style={[styles.tab, { backgroundColor: selected === index ? colors.accent : "transparent" }]}
    ><Text style={[styles.tabLabel, { color: selected === index ? colors.onAccent : colors.mutedText }]}>{title}</Text></Pressable>)}
  </View>;
}

function ProgressOverview() {
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [selectedPeriod, setSelectedPeriod] = useState(0);
  const isReferencePreview = __DEV__;
  const contentWidth = Math.min(windowWidth, 620) - 40;
  const chartWidth = Math.max(contentWidth - 32, 1);
  const chartHeight = 82;
  const trend = isReferencePreview ? referenceProgress.trend : [];
  const pointAt = (index: number) => ({
    x: chartWidth * (0.025 + index * (0.95 / Math.max(trend.length - 1, 1))),
    y: chartHeight * (0.83 - (trend[index] / 100) * 0.72),
  });
  const disciplines = isReferencePreview ? referenceProgress.disciplines : [
    { title: "Batting", score: null, icon: "practice" as const, color: "#F4CE63" },
    { title: "Bowling", score: null, icon: "analyze" as const, color: "#FF6969" },
    { title: "Keeping", score: null, icon: "award" as const, color: "#62B7F5" },
    { title: "Fielding", score: null, icon: "runner" as const, color: "#48E58C" },
  ];

  return <AppScreen>
    <View style={styles.progressHeading}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={styles.progressBack}
      >
        <AppIcon name="back" color={colors.text} size={20} />
      </Pressable>
      <Text accessibilityRole="header" style={[styles.progressTitle, { color: colors.text }]}>Your Progress</Text>
      <Text style={[styles.progressSubtitle, { color: colors.text }]}>Track your improvement across all disciplines.</Text>
    </View>

    <View accessibilityRole="tablist" style={[styles.periodTabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {progressPeriods.map((period, index) => <Pressable
        key={period}
        accessibilityRole="tab"
        accessibilityState={{ selected: selectedPeriod === index }}
        onPress={() => setSelectedPeriod(index)}
        style={[styles.periodTab, selectedPeriod === index && { backgroundColor: colors.accent }]}
      >
        <Text style={[styles.periodLabel, { color: selectedPeriod === index ? colors.onAccent : colors.text }]}>{period}</Text>
      </Pressable>)}
    </View>

    <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.overallHeading}>
        <Text accessibilityRole="header" style={[styles.cardHeading, { color: colors.text }]}>Overall Progress</Text>
        {isReferencePreview ? <Text style={[styles.change, { color: colors.accent }]}>+{referenceProgress.change}%</Text> : null}
      </View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={isReferencePreview
          ? "Sample progress chart rising from October 10 to October 28"
          : "Progress chart will appear after your first measured assessment"}
        style={[styles.chart, { width: chartWidth, height: chartHeight, backgroundColor: colors.background }]}
      >
        {[0.25, 0.5, 0.75, 1].map((position) => <View
          key={position}
          style={[styles.chartGridLine, { top: chartHeight * position, backgroundColor: colors.border }]}
        />)}
        {trend.map((_, index) => {
          const point = pointAt(index);
          return <View
            key={`area-${index}`}
            style={[styles.chartArea, {
              left: point.x - chartWidth * 0.035,
              top: point.y,
              width: chartWidth * 0.07,
              height: chartHeight - point.y,
              backgroundColor: colors.accent,
            }]}
          />;
        })}
        {trend.slice(1).map((_, index) => {
          const start = pointAt(index);
          const end = pointAt(index + 1);
          const width = Math.hypot(end.x - start.x, end.y - start.y);
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          return <View
            key={`segment-${index}`}
            style={[styles.chartSegment, {
              left: start.x,
              top: start.y,
              width,
              backgroundColor: colors.accent,
              transform: [{ rotate: `${angle}rad` }],
            }]}
          />;
        })}
        {trend.map((_, index) => {
          const point = pointAt(index);
          return <View
            key={`point-${index}`}
            style={[styles.chartPoint, { left: point.x - 2.5, top: point.y - 2.5, backgroundColor: colors.accent }]}
          />;
        })}
      </View>
      <View style={styles.dateLabels}>
        {(isReferencePreview ? referenceProgress.dates : ["", "", "", "", ""]).map((date, index) => (
          <Text key={`${date}-${index}`} style={[styles.dateLabel, { color: colors.mutedText }]}>{date}</Text>
        ))}
      </View>
    </View>

    <View style={[styles.progressCard, styles.breakdownCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text accessibilityRole="header" style={[styles.cardHeading, { color: colors.text }]}>Discipline Breakdown</Text>
      {disciplines.map(({ title, score, icon, color }) => <View key={title} style={styles.disciplineRow}>
        <View style={[styles.disciplineIcon, { backgroundColor: `${color}26` }]}>
          <AppIcon name={icon} color={color} size={16} />
        </View>
        <Text style={[styles.disciplineName, { color: colors.text }]}>{title}</Text>
        {score === null ? <View style={[styles.emptyTrack, { backgroundColor: colors.border }]} /> : (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`${title} progress`}
            accessibilityValue={{ min: 0, max: 100, now: score }}
            style={[styles.scoreTrack, { backgroundColor: colors.border }]}
          >
            <View style={[styles.scoreFill, { width: `${score}%`, backgroundColor: colors.accent }]} />
          </View>
        )}
        <Text style={[styles.scoreLabel, { color: colors.text }]}>{score === null ? "—" : `${score}%`}</Text>
        <AppIcon name="arrow" color={colors.mutedText} size={14} />
      </View>)}
      {!isReferencePreview ? <Text style={[styles.noProgress, { color: colors.mutedText }]}>
        Discipline scores will appear after measured results are available.
      </Text> : null}
    </View>
  </AppScreen>;
}

export function TrainingPreviewScreen({ feature }: { feature: "analyze" | "progress" }) {
  const { colors } = useAppTheme();
  const [selected, setSelected] = useState(0);
  if (feature === "progress") return <ProgressOverview />;
  const options = analysisSections;
  const section = options[selected];
  return (
    <AppScreen>
      <ScreenHeading
        title="AI Analysis"
        subtitle="A closer look at your technique."
      />
      <>
        <CricketArt compact />
        <PlayerCard title="Baseline first, progress reviews next">
          <Text style={[styles.body, { color: colors.mutedText }]}>After completing your profile, record or upload a cricket video for your baseline. Verified strengths and areas to improve will inform your personal roadmap. After practice, a progress video will be compared with that baseline before goals or stages can advance.</Text>
          <Text style={[styles.body, { color: colors.mutedText }]}>Player video upload, analysis and comparison are not available yet. Check-ins and logged drills are provisional practice, not verified video evidence. No goal achievement, stage advancement or certificate is awarded from practice logs.</Text>
        </PlayerCard>
        <ChoiceTabs options={options} selected={selected} onSelect={setSelected} />
        <PlayerCard title={section.heading}>
          <View style={[styles.featureIcon, { backgroundColor: colors.secondary }]}>
            <AppIcon name="analyze" color={colors.primary} size={36} />
          </View>
          <StatusBadge label="Coming soon" />
          <Text style={[styles.body, { color: colors.mutedText }]}>{section.detail}</Text>
          <AppButton onPress={() => router.navigate("/(app)/(tabs)/profile")}>
            Review my profile
          </AppButton>
        </PlayerCard>
        <PlayerCard title="Your analysis history">
          <Text style={[styles.body, { color: colors.mutedText }]}>Your clips stay personal. Analysis history and technique scorecards will be available in a future release.</Text>
          <AppButton variant="secondary" disabled>Record or upload video</AppButton>
        </PlayerCard>
      </>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 23 },
  tabs: { flexDirection: "row", borderRadius: 24, padding: 4, borderWidth: 1, flexWrap: "wrap" },
  tab: { flexGrow: 1, flexBasis: "30%", minHeight: 44, alignItems: "center", justifyContent: "center", padding: 8, borderRadius: 20 },
  tabLabel: { fontSize: 13, fontWeight: "700" },
  featureIcon: { height: 76, width: 76, borderRadius: 24, justifyContent: "center", alignItems: "center", marginVertical: 8 },
  progressHeading: { gap: 1, marginTop: 0, marginBottom: 4 },
  progressBack: { width: 22, height: 18, justifyContent: "center", alignItems: "flex-start" },
  progressTitle: { fontSize: 26, lineHeight: 31, fontWeight: "800", letterSpacing: -0.5 },
  progressSubtitle: { fontSize: 14, lineHeight: 18 },
  periodTabs: { flexDirection: "row", height: 38, borderRadius: 22, padding: 3, borderWidth: 1 },
  periodTab: { flex: 1, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  periodLabel: { fontSize: 12, fontWeight: "600" },
  progressCard: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  overallHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardHeading: { fontSize: 14, lineHeight: 18, fontWeight: "700" },
  change: { fontSize: 13, fontWeight: "700" },
  chart: { alignSelf: "center", overflow: "hidden", borderRadius: 4, position: "relative" },
  chartGridLine: { position: "absolute", left: 0, right: 0, height: 1, opacity: 0.5 },
  chartArea: { position: "absolute", opacity: 0.12 },
  chartSegment: { position: "absolute", height: 2, transformOrigin: "left center" },
  chartPoint: { position: "absolute", width: 5, height: 5, borderRadius: 3 },
  dateLabels: { flexDirection: "row", justifyContent: "space-between" },
  dateLabel: { fontSize: 9, lineHeight: 12 },
  breakdownCard: { gap: 8 },
  disciplineRow: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 7 },
  disciplineIcon: { width: 21, height: 21, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  disciplineName: { width: 58, fontSize: 12, fontWeight: "600" },
  scoreTrack: { height: 7, flex: 1, overflow: "hidden", borderRadius: 6 },
  emptyTrack: { height: 7, flex: 1, borderRadius: 6 },
  scoreFill: { height: "100%", borderRadius: 6 },
  scoreLabel: { width: 31, textAlign: "right", fontSize: 11, fontWeight: "600" },
  noProgress: { fontSize: 11, lineHeight: 15 },
});
