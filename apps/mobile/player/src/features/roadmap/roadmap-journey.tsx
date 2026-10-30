import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon, type AppIconName } from "../../components/ui/app-icon";
import { roadmapDisciplines, type PlayerRoadmap } from "./roadmap-api";
import { RoadmapButton, RoadmapCard, useRoadmapTheme } from "./roadmap-ui";

const journeySteps = [
  { id: 0, title: "Quick Setup", detail: "Tell us about yourself." },
  { id: 1, title: "Baseline Check", detail: "Your video. Your starting point." },
  { id: 2, title: "AI Builds Your Plan", detail: "One focus. Small, achievable goals." },
  { id: 3, title: "Weekly Self-Coaching Loop", detail: "Practice. Record. Review. Improve." },
  { id: 4, title: "Stage Progression", detail: "Build your game, stage by stage." },
] as const;
export type JourneyStep = 0 | 1 | 2 | 3 | 4;
export const journeyStepTitle = (step: JourneyStep) => journeySteps[step].title;

const stageFramework = [
  { title: "Foundation", detail: "Technique basics", icon: "practice", color: "planAccent" },
  { title: "Consistency", detail: "Repeatable skills", icon: "progress", color: "blue" },
  { title: "Execution", detail: "Pressure execution", icon: "trophy", color: "gold" },
  { title: "Match Ready", detail: "Game confidence", icon: "award", color: "purple" },
] as const;

function InfoRow({ icon, title, detail }: { icon: AppIconName; title: string; detail: string }) {
  const { colors } = useRoadmapTheme();
  return <View style={styles.infoRow}>
    <View style={[styles.iconBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <AppIcon name={icon} color={colors.planAccent} size={22} />
    </View>
    <View style={styles.copy}>
      <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.small, { color: colors.mutedText }]}>{detail}</Text>
    </View>
  </View>;
}

export function StageProgression() {
  const { colors } = useRoadmapTheme();
  return <RoadmapCard title="Stage progression">
    <Text style={[styles.body, { color: colors.mutedText }]}>A look at the journey ahead. Your stage is not yet assessed.</Text>
    {stageFramework.map(stage => <View key={stage.title} style={[styles.stageRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <View style={[styles.stageIcon, { borderColor: colors[stage.color] }]}>
        <AppIcon name={stage.icon} size={24} color={colors[stage.color]} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{stage.title}</Text>
        <Text style={[styles.small, { color: colors.mutedText }]}>{stage.detail}</Text>
      </View>
      <Text style={[styles.locked, { color: colors.mutedText }]}>Locked</Text>
    </View>)}
    <Text style={[styles.small, { color: colors.mutedText }]}>Stage assessment and certificates are coming later. Practice logs alone do not unlock a stage.</Text>
  </RoadmapCard>;
}

export function RoadmapJourney({ roadmap, step, onStep, onCheckIn, onDrills, onCertificates }: {
  roadmap: PlayerRoadmap; step: JourneyStep | null; onStep: (step: JourneyStep) => void;
  onCheckIn: () => void; onDrills: () => void; onCertificates: () => void;
}) {
  const { colors } = useRoadmapTheme();
  const profileReady = roadmap.journey.nextStep === "VIDEO_BASELINE";
  const next = profileReady ? 1 : 0;
  const latest = roadmap.revisions[0];
  const hasAnswers = roadmapDisciplines.every(discipline => !!roadmap.answers[discipline]);
  const focus = latest?.snapshot.recommendations.find(row => row.discipline === roadmap.primaryDisciplines[0]);
  const openNext = () => router.navigate(profileReady ? "/(app)/(tabs)/analyze" : "/(app)/(tabs)/profile");
  if (step === null) return <View style={styles.content}>
    <View style={styles.timeline}>
      {journeySteps.map((item, index) => {
        const active = index === next;
        const complete = index === 0 && profileReady;
        return <Pressable key={item.title} accessibilityRole="button"
          accessibilityLabel={`${index + 1}. ${item.title}${active ? " · Next step" : complete ? " · Profile saved" : ""}`}
          onPress={() => onStep(item.id)}
          style={({ pressed }) => [styles.timelineRow, { opacity: pressed ? 0.7 : 1 }]}>
          <View style={styles.rail}>
            {index < journeySteps.length - 1 ? <View style={[styles.connector, { backgroundColor: colors.planBorder }]} /> : null}
            <View style={[styles.number, {
              backgroundColor: active || complete ? colors.planAccent : colors.planSurface,
              borderColor: active || complete ? colors.planAccent : colors.planBorder,
            }]}>
              <Text style={[styles.numberText, { color: active || complete ? colors.onPlanAccent : colors.mutedText }]}>{complete ? "\u2713" : index + 1}</Text>
            </View>
          </View>
          <View style={styles.timelineCopy}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.small, { color: active ? colors.planAccent : colors.mutedText }]}>
              {active ? index === 0 ? "Next step · Complete your profile" : "Next step · Video baseline coming soon" : complete ? "Profile saved" : item.detail}
            </Text>
          </View>
          <AppIcon name="arrow" size={18} color={active ? colors.planAccent : colors.mutedText} />
        </Pressable>;
      })}
    </View>
    <View style={[styles.nextCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.infoRow}>
        <AppIcon name="bulb" color={colors.planAccent} size={24} />
        <View style={styles.copy}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{profileReady ? "Your video starts the journey" : "Make it your roadmap"}</Text>
          <Text style={[styles.small, { color: colors.mutedText }]}>{profileReady
            ? "Video baseline analysis is coming soon. Explore practice while you wait."
            : "Add your disciplines, experience and goals to get started."}</Text>
        </View>
      </View>
      <RoadmapButton variant={latest ? "secondary" : "primary"} onPress={openNext}>
        {profileReady ? "About video baseline" : "Complete player profile"}
      </RoadmapButton>
    </View>
    {latest ? <RoadmapButton onPress={onDrills}>View Recommended Drills</RoadmapButton> :
      !hasAnswers ? <RoadmapButton variant="secondary" onPress={onCheckIn}>Start practice check-in</RoadmapButton> : null}
    <Text style={[styles.footnote, { color: colors.mutedText }]}>Practice suggestions are provisional. Your personal roadmap starts with verified video analysis.</Text>
  </View>;

  return <View style={styles.content}>
    <View style={styles.detailHeading}>
      <View style={[styles.number, { backgroundColor: colors.planAccent, borderColor: colors.planAccent }]}>
        <Text style={[styles.numberText, { color: colors.onPlanAccent }]}>{step + 1}</Text>
      </View>
      <Text style={[styles.body, { color: colors.mutedText }]}>{journeySteps[step].detail}</Text>
    </View>
    {step === 0 ? <RoadmapCard title="A plan that starts with you">
      <InfoRow icon="profile" title="Player profile" detail="Your name and playing preferences" />
      <InfoRow icon="practice" title="Your game" detail="Batting, bowling, keeping or fielding" />
      <InfoRow icon="progress" title="Experience level" detail="Where you feel you are today" />
      <InfoRow icon="list" title="Goals" detail={roadmap.goals.length ? roadmap.goals.join(" · ") : "What do you want to improve?"} />
      <RoadmapButton onPress={() => router.navigate("/(app)/(tabs)/profile")}>{profileReady ? "Review player profile" : "Complete player profile"}</RoadmapButton>
    </RoadmapCard> : null}
    {step === 1 ? <RoadmapCard title="Find your starting point">
      <View style={[styles.videoPreview, { borderColor: colors.border }]}>
        <Image source={require("../../../assets/roadmap-baseline.png")} accessibilityLabel="Example cricket video setup, not your personal analysis" style={styles.videoImage} resizeMode="cover" />
        <View style={[styles.videoCaption, { backgroundColor: colors.planAccent }]}><AppIcon name="video" size={18} color={colors.onPlanAccent} /><Text style={[styles.videoLabel, { color: colors.onPlanAccent }]}>VIDEO BASELINE · COMING SOON</Text></View>
      </View>
      <InfoRow icon="camera" title="Record your technique" detail="One guided cricket video to establish your baseline." />
      <InfoRow icon="list" title="Add your self-assessment" detail="Tell us what feels difficult and what you want to improve." />
      <Text style={[styles.body, { color: colors.mutedText }]}>Your video will reveal strengths and areas to work on. Your profile and goals help make the plan personal.</Text>
      <RoadmapButton onPress={() => router.navigate("/(app)/(tabs)/analyze")}>About video baseline</RoadmapButton>
      <RoadmapButton variant="secondary" onPress={onCheckIn}>Answer practice questions</RoadmapButton>
    </RoadmapCard> : null}
    {step === 2 ? <RoadmapCard title="Your next two weeks">
      <Text style={[styles.status, { color: colors.planAccent, backgroundColor: colors.planTrack }]}>PERSONAL PLAN · AWAITING VIDEO BASELINE</Text>
      <InfoRow icon="practice" title="Primary focus" detail="One priority informed by your video analysis" />
      <InfoRow icon="practice" title="Secondary focus" detail="A supporting skill to work on alongside it" />
      <InfoRow icon="list" title="2-week goals" detail="Small, clear targets to guide your practice" />
      <InfoRow icon="runner" title="Recommended drills" detail="Step-by-step exercises for your focus" />
      <InfoRow icon="progress" title="Success metric" detail="Supported technique feedback, not drill counts" />
      <Text style={[styles.small, { color: colors.mutedText }]}>This is how your personal plan will work. No video-based plan or review date has been set yet.</Text>
      {latest ? <View style={[styles.previewFocus, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.statusLabel, { color: colors.planAccent }]}>AVAILABLE NOW · PROVISIONAL PRACTICE</Text>
        <Text style={[styles.body, { color: colors.text }]}>{focus?.objective ?? "Explore suggestions based on your goals and practice check-in."}</Text>
      </View> : null}
      <RoadmapButton onPress={latest ? onDrills : onCheckIn}>{latest ? "View Recommended Drills" : "Start practice check-in"}</RoadmapButton>
    </RoadmapCard> : null}
    {step === 3 ? <RoadmapCard title="A simple loop. Real commitment.">
      <Text style={[styles.body, { color: colors.mutedText }]}>Stay focused on one goal. Practise, reflect and repeat.</Text>
      <View accessible accessibilityLabel="Practice, then record, then review, then adjust. Repeat the self-coaching loop." style={styles.loop}>
        {([
          [{ title: "Practice", icon: "runner", detail: "Do your recommended drills" }],
          [{ title: "Adjust", icon: "settings", detail: "Refine your focus and goals" },
            { title: "Record", icon: "camera", detail: "Capture a progress video" }],
          [{ title: "Review", icon: "progress", detail: "Compare with your baseline" }],
        ] satisfies { title: string; icon: AppIconName; detail: string }[][]).map((row, index) =>
          <View key={index} style={[styles.loopRow, { justifyContent: row.length === 1 ? "center" : "space-between" }]}>
            {row.map(item => <View key={item.title} style={[styles.loopItem, { borderColor: colors.planAccent, backgroundColor: colors.background }]}>
              <AppIcon name={item.icon} color={colors.planAccent} size={24} />
              <Text style={[styles.loopTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.loopDetail, { color: colors.mutedText }]}>{item.detail}</Text>
            </View>)}
          </View>)}
        <Text accessible={false} style={[styles.loopArrow, styles.arrowTopLeft, { color: colors.planAccent }]}>&#8599;</Text>
        <Text accessible={false} style={[styles.loopArrow, styles.arrowTopRight, { color: colors.planAccent }]}>&#8600;</Text>
        <Text accessible={false} style={[styles.loopArrow, styles.arrowBottomRight, { color: colors.planAccent }]}>&#8601;</Text>
        <Text accessible={false} style={[styles.loopArrow, styles.arrowBottomLeft, { color: colors.planAccent }]}>&#8598;</Text>
      </View>
      <Text style={[styles.small, { color: colors.mutedText }]}>Video recording and comparisons are coming soon. For now, log practice and reflections; these do not assess your skill.</Text>
      <RoadmapButton onPress={latest ? onDrills : onCheckIn}>{latest ? "Practise your drills" : "Start practice check-in"}</RoadmapButton>
      <RoadmapButton variant="secondary" onPress={onCheckIn}>Review goals & practice history</RoadmapButton>
    </RoadmapCard> : null}
    {step === 4 ? <>
      <StageProgression />
      <RoadmapButton variant="secondary" onPress={onCertificates}>View certificate eligibility</RoadmapButton>
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  timeline: { paddingTop: 6 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 68 },
  rail: { width: 32, alignSelf: "stretch", alignItems: "center", paddingTop: 18 },
  connector: { position: "absolute", top: 40, bottom: -19, width: 1.5 },
  number: { height: 32, width: 32, borderWidth: 1.5, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  numberText: { fontSize: 15, fontWeight: "800" },
  timelineCopy: { flex: 1, gap: 5, paddingVertical: 12 },
  stepTitle: { fontSize: 16, fontWeight: "700", lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 19 },
  body: { fontSize: 15, lineHeight: 23 },
  nextCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 14 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 42, height: 42, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: "700", lineHeight: 21 },
  footnote: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  detailHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  videoPreview: { borderRadius: 12, overflow: "hidden", borderWidth: 1 },
  videoImage: { width: "100%", height: 155 },
  videoCaption: { padding: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  videoLabel: { fontSize: 11, fontWeight: "800", flexShrink: 1, letterSpacing: 0.5 },
  status: { fontSize: 11, lineHeight: 17, fontWeight: "700", padding: 10, borderRadius: 8, letterSpacing: 0.4 },
  statusLabel: { fontSize: 11, lineHeight: 17, fontWeight: "700", letterSpacing: 0.4 },
  previewFocus: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  loop: { paddingVertical: 8 },
  loopRow: { flexDirection: "row", marginVertical: -8 },
  loopItem: { width: "40%", minHeight: 116, aspectRatio: 1, borderWidth: 1, borderRadius: 100, padding: 10, justifyContent: "center", alignItems: "center", gap: 4 },
  loopTitle: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  loopDetail: { textAlign: "center", fontSize: 11, lineHeight: 15 },
  loopArrow: { position: "absolute", fontSize: 28 },
  arrowTopLeft: { left: "14%", top: "16%" },
  arrowTopRight: { right: "14%", top: "16%" },
  arrowBottomLeft: { left: "14%", bottom: "16%" },
  arrowBottomRight: { right: "14%", bottom: "16%" },
  stageRow: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 12, flexDirection: "row", alignItems: "center" },
  stageIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  locked: { fontSize: 11, fontWeight: "600" },
});
