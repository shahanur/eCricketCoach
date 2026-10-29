import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CricketArt } from "../../components/brand/cricket-art";
import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { AppIcon } from "../../components/ui/app-icon";
import { PlayerCard, StatusBadge } from "../../components/ui/player-card";
import { ScreenHeading } from "../../components/ui/screen-heading";
import { useAppTheme } from "../../theme/use-app-theme";

const progressSections = [
  { title: "Roadmap", heading: "Your next chapter", detail: "Personal stages across batting, bowling, keeping and fielding are coming soon. Set your disciplines and goals in your profile while you prepare." },
  { title: "Goals", heading: "Give your training a focus", detail: "Your personal goals live in your profile. Add or review them there as you work towards your next stage." },
  { title: "Certificates", heading: "Achievements worth keeping", detail: "Progression certificates are coming soon. Awards will appear here when eligible milestones are available." },
] as const;

const analysisSections = [
  { title: "Analysis", heading: "See your technique differently", detail: "Video recording, uploads and personal feedback are coming soon. Your own clips and results will appear here when analysis is available." },
  { title: "Pose", heading: "Understand your movement", detail: "Pose feedback is coming soon. Movement overlays will be shown only when supported by your video analysis." },
  { title: "Metrics", heading: "Feedback you can trust", detail: "Technique metrics are coming soon. Scores and measurements will appear only when supported by your own analysis results." },
] as const;

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

export function TrainingPreviewScreen({ feature }: { feature: "analyze" | "progress" }) {
  const { colors } = useAppTheme();
  const [selected, setSelected] = useState(0);
  const options = feature === "analyze" ? analysisSections : progressSections;
  const section = options[selected];
  return (
    <AppScreen>
      <ScreenHeading
        title={feature === "analyze" ? "AI Analysis" : "Your progress"}
        subtitle={feature === "analyze" ? "A closer look at your technique." : "Your journey across all four disciplines."}
      />
      <>
        {feature === "analyze" ? <CricketArt compact /> : null}
        <ChoiceTabs options={options} selected={selected} onSelect={setSelected} />
        <PlayerCard title={section.heading}>
          <View style={[styles.featureIcon, { backgroundColor: colors.secondary }]}>
            <AppIcon name={feature === "analyze" ? "analyze" : selected === 2 ? "award" : "progress"} color={colors.primary} size={36} />
          </View>
          {feature === "progress" && selected === 1 ? null : <StatusBadge label="Coming soon" />}
          <Text style={[styles.body, { color: colors.mutedText }]}>{section.detail}</Text>
          <AppButton onPress={() => router.navigate("/(app)/(tabs)/profile")}>
            {feature === "progress" && selected === 1 ? "Review my goals" : "Review my profile"}
          </AppButton>
        </PlayerCard>
        {feature === "analyze" ? <PlayerCard title="Your analysis history">
          <Text style={[styles.body, { color: colors.mutedText }]}>Your clips stay personal. Analysis history and technique scorecards will be available in a future release.</Text>
          <AppButton variant="secondary" disabled>Record or upload video</AppButton>
        </PlayerCard> : <PlayerCard title="Built around your game">
          <Text style={[styles.body, { color: colors.mutedText }]}>Your saved preferences are a starting point, not an assessed skill level. Progress charts will appear when measured results are available.</Text>
        </PlayerCard>}
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
});
