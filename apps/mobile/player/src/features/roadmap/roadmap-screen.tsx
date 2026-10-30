import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { ApiError, getUserFacingErrorMessage } from "../../api/api-error";
import { AppScreen } from "../../components/layout/app-screen";
import { AppIcon } from "../../components/ui/app-icon";
import { useSession } from "../../session/session-context";
import { journeyStepTitle, RoadmapJourney, StageProgression, type JourneyStep } from "./roadmap-journey";
import { RoadmapButton as AppButton, RoadmapCard as PlayerCard, useRoadmapTheme as useAppTheme } from "./roadmap-ui";
import {
  completeRoadmapDrill, generateRoadmap, getRoadmap, roadmapDisciplines, roadmapRequestId,
  saveRoadmapAnswers, type PlayerRoadmap, type RoadmapAnswers, type RoadmapDiscipline, type RoadmapDrill,
} from "./roadmap-api";

const labels: Record<RoadmapDiscipline, string> = {
  BATTING: "Batting", BOWLING: "Bowling", KEEPING: "Keeping", FIELDING: "Fielding",
};

function RoadmapTabs<T extends string>({ options, selected, onSelect, label }: {
  options: readonly { value: T; label: string }[]; selected: T; onSelect: (value: T) => void; label: string;
}) {
  const { colors } = useAppTheme();
  return <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.tabs, { backgroundColor: colors.planTrack }]}>
    {options.map(option => <Pressable key={option.value} accessibilityRole="tab" accessibilityLabel={option.label}
      accessibilityState={{ selected: selected === option.value }} onPress={() => onSelect(option.value)}
      style={[styles.tab, { backgroundColor: selected === option.value ? colors.planAccent : "transparent" }]}>
      <Text style={[styles.tabLabel, { color: selected === option.value ? colors.onPlanAccent : colors.mutedText }]}>{option.label}</Text>
    </Pressable>)}
  </View>;
}

const disciplineTabs = roadmapDisciplines.map(value => ({ value, label: labels[value] }));
const pageTabs = [
  { value: "path", label: "Roadmap" }, { value: "check-in", label: "Goals" }, { value: "certificates", label: "Certificates" },
] as const;

function DrillInstructions({ instructions }: { instructions: string | null }) {
  const { colors } = useAppTheme();
  if (!instructions) return <Text style={[styles.body, { color: colors.text }]}>Detailed instructions are not available for this drill.</Text>;
  const sections = instructions.split(/(?:^|\n)\s*(Equipment|Setup|Steps|Cues|Safety):\s*/i);
  return <View style={styles.group}>
    {sections[0].trim() ? <Text style={[styles.body, { color: colors.text }]}>{sections[0].trim()}</Text> : null}
    {sections.slice(1).map((part, index, parts) => index % 2 === 0 ? <View key={index}
      style={[styles.instructionSection, { backgroundColor: colors.background, borderLeftColor: part.toLowerCase() === "safety" ? colors.gold : colors.primary }]}>
      <Text accessibilityRole="header" style={[styles.label, { color: part.toLowerCase() === "safety" ? colors.gold : colors.primary }]}>{part}</Text>
      <Text style={[styles.body, { color: colors.text }]}>{parts[index + 1]?.trim()}</Text>
    </View> : null)}
  </View>;
}

function AnswersForm({ roadmap, onSaved, onError }: { roadmap: PlayerRoadmap; onSaved: (data: PlayerRoadmap) => void; onError: (error: Error) => void }) {
  const { colors } = useAppTheme();
  const [answers, setAnswers] = useState<RoadmapAnswers>(() => Object.fromEntries(roadmapDisciplines.map(discipline => [
    discipline, roadmap.answers[discipline] ?? { focus: "", confidence: 3 },
  ])) as RoadmapAnswers);
  const [invalid, setInvalid] = useState(false);
  const [discipline, setDiscipline] = useState<RoadmapDiscipline>("BATTING");
  const mutation = useMutation({ mutationFn: () => saveRoadmapAnswers(roadmap.version, answers), onSuccess: onSaved, onError });
  return <PlayerCard title="Your practice check-in">
    <Text style={[styles.body, { color: colors.mutedText }]}>Tell us what you want to improve and how confident you feel. Your answers are self-reported, not measured skill scores.</Text>
    <RoadmapTabs options={disciplineTabs} selected={discipline} onSelect={setDiscipline} label="Check-in discipline" />
    <Text style={[styles.caption, { color: colors.mutedText }]}>{roadmapDisciplines.filter(value => answers[value].focus.trim()).length} of 4 focuses added · Save all four together</Text>
    <View style={styles.group}>
      <Text style={[styles.label, { color: colors.text }]}>{labels[discipline]}</Text>
      <TextInput
        accessibilityLabel={`${labels[discipline]} improvement focus`}
        placeholder="What feels difficult or needs work?"
        placeholderTextColor={colors.mutedText}
        maxLength={300} multiline editable={!mutation.isPending}
        value={answers[discipline].focus}
        onChangeText={focus => setAnswers(current => ({ ...current, [discipline]: { ...current[discipline], focus } }))}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
      />
      <Text style={[styles.caption, { color: colors.mutedText }]}>Confidence: 1 = learning, 5 = very confident</Text>
      <View style={styles.choices}>
        {[1, 2, 3, 4, 5].map(confidence => <Pressable
          key={confidence} accessibilityRole="radio" accessibilityLabel={`${labels[discipline]} confidence ${confidence}`}
          accessibilityState={{ checked: answers[discipline].confidence === confidence }}
          disabled={mutation.isPending}
          onPress={() => setAnswers(current => ({ ...current, [discipline]: { ...current[discipline], confidence } }))}
          style={[styles.choice, { borderColor: colors.border, backgroundColor: answers[discipline].confidence === confidence ? colors.accent : colors.background }]}
        ><Text style={{ color: answers[discipline].confidence === confidence ? colors.onAccent : colors.text }}>{confidence}</Text></Pressable>)}
      </View>
    </View>
    {invalid ? <Text accessibilityRole="alert" style={{ color: colors.error }}>Add an improvement focus for each discipline.</Text> : null}
    {mutation.error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{getUserFacingErrorMessage(mutation.error)}</Text> : null}
    <AppButton disabled={mutation.isPending} onPress={() => {
      const missing = roadmapDisciplines.find(value => !answers[value].focus.trim());
      if (missing) { setDiscipline(missing); setInvalid(true); return; }
      setInvalid(false);
      mutation.mutate();
    }}>{mutation.isPending ? "Saving check-in..." : "Save check-in"}</AppButton>
  </PlayerCard>;
}

function DrillPractice({ drill, revisionId, onSaved, completed, readOnly, onError }: {
  drill: RoadmapDrill; revisionId: string; onSaved: (data: PlayerRoadmap) => void; completed: boolean; readOnly: boolean;
  onError: (error: Error) => void;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [logging, setLogging] = useState(false);
  const [minutes, setMinutes] = useState(String(drill.duration));
  const [reflection, setReflection] = useState("");
  const [invalid, setInvalid] = useState(false);
  const pendingRequest = useRef<{ requestId: string; revisionId: string; drillId: string; minutes: number; reflection: string } | null>(null);
  const mutation = useMutation({
    mutationFn: () => {
      const payload = { revisionId, drillId: drill.id, minutes: Number(minutes), reflection: reflection.trim() };
      const previous = pendingRequest.current;
      if (!previous || previous.minutes !== payload.minutes || previous.reflection !== payload.reflection) {
        pendingRequest.current = { ...payload, requestId: roadmapRequestId() };
      }
      return completeRoadmapDrill(pendingRequest.current!);
    }, onSuccess: onSaved, onError,
  });
  return <View style={[styles.drill, { borderColor: colors.border, backgroundColor: colors.surface }]}>
    <View style={styles.inlineHeading}>
      <Text style={[styles.eyebrow, { color: colors.gold }]}>RECOMMENDED DRILL</Text>
      <Text style={[styles.badge, { color: colors.primary, backgroundColor: colors.secondary }]}>{drill.duration} min</Text>
    </View>
    <Text accessibilityRole="header" style={[styles.drillTitle, { color: colors.text }]}>{drill.title}</Text>
    <Text style={[styles.body, { color: colors.text }]}>{drill.reason}</Text>
    <AppButton variant="secondary" onPress={() => setOpen(current => !current)}>{open ? "Hide drill" : "View drill"}</AppButton>
    {open ? <DrillInstructions instructions={drill.instructions} /> : null}
    {completed ? <Text style={[styles.label, { color: colors.primary }]}>Completed · Self-reported</Text> : readOnly ? <Text style={{ color: colors.mutedText }}>Previous path · View only</Text> : <>
      <AppButton variant="secondary" onPress={() => setLogging(current => !current)}>{logging ? "Close practice log" : "Log practice"}</AppButton>
      <View style={logging ? styles.group : styles.hidden} accessibilityElementsHidden={!logging} importantForAccessibility={logging ? "auto" : "no-hide-descendants"}>
        <Text accessibilityRole="header" style={[styles.label, { color: colors.primary }]}>Log completed practice</Text>
        <Text style={[styles.caption, { color: colors.text }]}>Time practised (minutes)</Text>
        <TextInput accessibilityLabel={`${drill.title} minutes`} value={minutes} onChangeText={setMinutes} keyboardType="number-pad" editable={!mutation.isPending} style={[styles.input, { borderColor: colors.border, color: colors.text }]} />
        <Text style={[styles.caption, { color: colors.text }]}>Your reflection</Text>
        <TextInput accessibilityLabel={`${drill.title} reflection`} placeholder="What did you work on and notice?" placeholderTextColor={colors.mutedText} value={reflection} onChangeText={setReflection} maxLength={500} multiline editable={!mutation.isPending} style={[styles.input, { borderColor: colors.border, color: colors.text }]} />
        {invalid ? <Text accessibilityRole="alert" style={{ color: colors.error }}>Enter 1–180 minutes and a short practice reflection.</Text> : null}
        {mutation.error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{getUserFacingErrorMessage(mutation.error)}</Text> : null}
        <AppButton disabled={mutation.isPending} onPress={() => {
          if (!Number.isInteger(Number(minutes)) || Number(minutes) < 1 || Number(minutes) > 180 || !reflection.trim()) { setInvalid(true); return; }
          setInvalid(false); mutation.mutate();
        }}>{mutation.isPending ? "Saving practice..." : "Record completion"}</AppButton>
      </View>
    </>}
  </View>;
}

export function RoadmapContent({ roadmap, onChanged, onAccessDenied }: {
  roadmap: PlayerRoadmap; onChanged: (data: PlayerRoadmap) => void; onAccessDenied?: (error: ApiError) => void;
}) {
  const { colors } = useAppTheme();
  const [page, setPage] = useState<"path" | "check-in" | "certificates">("path");
  const [showDrills, setShowDrills] = useState(false);
  const [journeyStep, setJourneyStep] = useState<JourneyStep | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [discipline, setDiscipline] = useState<RoadmapDiscipline>(roadmap.primaryDisciplines[0] ?? "BATTING");
  const [stageInfo, setStageInfo] = useState(false);
  const [revisionLimit, setRevisionLimit] = useState(5);
  const [practiceLimit, setPracticeLimit] = useState(5);
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null);
  const generation = useRef<{ version: number; profileVersion: number; requestId: string } | null>(null);
  const handleError = (error: Error) => {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) onAccessDenied?.(error);
  };
  const generate = useMutation({
    mutationFn: () => {
      if (generation.current?.version !== roadmap.version || generation.current.profileVersion !== roadmap.profileVersion) {
        generation.current = { version: roadmap.version, profileVersion: roadmap.profileVersion, requestId: roadmapRequestId() };
      }
      return generateRoadmap(roadmap.version, generation.current.requestId);
    },
    onSuccess: data => { generation.current = null; setSelectedRevision(null); setPage("path"); setShowDrills(false); onChanged(data); },
    onError: handleError,
  });
  const revision = roadmap.revisions.find(entry => entry.id === selectedRevision) ?? roadmap.revisions[0];
  const currentRevision = revision?.id === roadmap.revisions[0]?.id;
  const hasAnswers = roadmapDisciplines.every(discipline => !!roadmap.answers[discipline]);
  const inDetail = page === "path" && (showDrills || journeyStep !== null);
  const backToRoadmap = useCallback(() => { setShowDrills(false); setJourneyStep(null); }, []);
  useFocusEffect(useCallback(() => {
    if (!inDetail) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { backToRoadmap(); return true; });
    return () => subscription.remove();
  }, [inDetail, backToRoadmap]));
  return <View style={styles.planContent}>
    <View style={styles.heading}>
      <Pressable accessibilityRole="button" accessibilityLabel={inDetail ? "Back to roadmap" : "Back to home"}
        onPress={() => inDetail ? backToRoadmap() : router.navigate("/(app)/(tabs)/home")} style={styles.backButton}>
        <Text accessible={false} style={[styles.backArrow, { color: colors.text }]}>←</Text>
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{page === "path" && showDrills ? "Your Drills" : page === "path" && journeyStep !== null ? journeyStepTitle(journeyStep) : "Your Plan"}</Text>
      <Text style={[styles.planSubtitle, { color: colors.mutedText }]}>{showDrills && page === "path" ? "Stay focused. Practise with purpose." : "Simple AI-guided self-coaching, built around you."}</Text>
    </View>
    <RoadmapTabs options={pageTabs} selected={page} onSelect={setPage} label="Roadmap sections" />
    <View style={page === "path" ? styles.content : styles.hidden} accessibilityElementsHidden={page !== "path"} importantForAccessibility={page === "path" ? "auto" : "no-hide-descendants"}>
    {!showDrills ? <RoadmapJourney roadmap={roadmap} step={journeyStep} onStep={setJourneyStep}
      onCheckIn={() => setPage("check-in")} onDrills={() => { setSelectedRevision(null); setJourneyStep(null); setShowDrills(true); }}
      onCertificates={() => setPage("certificates")} /> : null}
    {roadmap.needsReassessment ? <Text accessibilityLiveRegion="polite" style={[styles.body, { color: colors.primary }]}>Your goals or practice evidence have changed. Refresh your suggestions; previous practice stays saved.</Text> : null}
    {generate.error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{getUserFacingErrorMessage(generate.error)}</Text> : null}
    {revision ? <>
      {!showDrills && journeyStep === null ? <>
        <View style={styles.planFooter}>
          <Pressable accessibilityRole="button" onPress={() => setPage("check-in")} style={styles.textButton}><Text style={[styles.caption, { color: colors.mutedText }]}>Update goals & check-in</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={generate.isPending || roadmap.generating} onPress={() => generate.mutate()}
            accessibilityState={{ disabled: generate.isPending || roadmap.generating }} style={styles.textButton}>
            <Text style={[styles.caption, { color: colors.planAccent }]}>{generate.isPending || roadmap.generating ? "Preparing practice..." : "Refresh practice suggestions"}</Text>
          </Pressable>
        </View>
      </> : null}
      <View style={showDrills ? styles.content : styles.hidden} accessibilityElementsHidden={!showDrills} importantForAccessibility={showDrills ? "auto" : "no-hide-descendants"}>
      <View style={styles.inlineHeading}>
        <Text style={[styles.caption, { color: colors.mutedText }]}>{currentRevision ? "Latest path" : "Previous path · View only"} · {new Date(revision.createdAt).toLocaleDateString()}</Text>
        {!currentRevision ? <Pressable accessibilityRole="button" onPress={() => setSelectedRevision(null)} style={styles.textButton}><Text style={[styles.label, { color: colors.primary }]}>Back to latest</Text></Pressable> : null}
      </View>
      <RoadmapTabs options={disciplineTabs} selected={discipline} onSelect={setDiscipline} label="Training discipline" />
      {roadmapDisciplines.map(value => {
        const recommendation = revision.snapshot.recommendations.find(row => row.discipline === value);
        const drills = recommendation?.drills ?? [];
        const completed = drills.filter(drill => roadmap.practice.some(entry => entry.revisionId === revision.id && entry.drillId === drill.id)).length;
        return <View key={`${revision.id}-${value}`} style={value === discipline ? styles.content : styles.hidden}
          accessibilityElementsHidden={value !== discipline} importantForAccessibility={value === discipline ? "auto" : "no-hide-descendants"}>
          <View style={[styles.summaryRow, { borderColor: colors.border }]}>
            {[["Discipline", labels[value]], ["Drills", String(drills.length)], ["Logged", `${completed}/${drills.length}`]].map(([label, text]) => <View key={label} style={styles.summaryCell}>
              <Text style={[styles.caption, { color: colors.mutedText }]}>{label}</Text>
              <Text style={[styles.label, { color: colors.text }]}>{text}</Text>
            </View>)}
          </View>
          {drills.length ? <View style={styles.group}>
            <Text style={[styles.caption, { color: colors.mutedText }]}>{completed} of {drills.length} drills logged · {Math.round(completed / drills.length * 100)}%</Text>
            <View accessible accessibilityRole="progressbar" accessibilityLabel={`${labels[value]} drills logged`}
              accessibilityValue={{ min: 0, max: drills.length, now: completed, text: "Self-reported practice, not assessed skill" }}
              style={[styles.practiceTrack, { backgroundColor: colors.planTrack }]}>
              <View style={[styles.practiceFill, { backgroundColor: colors.planAccent, width: `${completed / drills.length * 100}%` }]} />
            </View>
          </View> : null}
          <Text style={[styles.caption, { color: colors.mutedText }]}>Provisional practice · Based on your check-in, not verified video.</Text>
          <View style={[styles.focusCard, { backgroundColor: colors.secondary, borderLeftColor: colors.primary }]}>
            <Text accessibilityRole="header" style={[styles.eyebrow, { color: colors.primary }]}>YOUR {labels[value].toUpperCase()} FOCUS</Text>
            <Text style={[styles.recommendation, { color: colors.text }]}>{recommendation?.objective}</Text>
            {recommendation?.proposedStage ? <Text style={[styles.caption, { color: colors.text }]}>Provisional AI suggestion: {recommendation.proposedStage}. This is not an assessed stage.</Text> : null}
            <Text style={[styles.caption, { color: colors.mutedText }]}>Based on: {recommendation?.evidence.map(id => id.startsWith("qa:") ? `${labels[id.slice(3) as RoadmapDiscipline]} check-in` : id === "profile" ? "Profile goals and preferences" : "Self-reported practice").join(", ")}</Text>
          </View>
          {!drills.length ? <Text style={[styles.body, { color: colors.mutedText }]}>No suitable drills are available for this path yet.</Text> : drills.map(drill => <DrillPractice
            key={`${revision.id}-${drill.id}`} drill={drill} revisionId={revision.id} onSaved={onChanged}
            completed={roadmap.practice.some(entry => entry.revisionId === revision.id && entry.drillId === drill.id)}
            readOnly={!currentRevision}
            onError={handleError}
          />)}
        </View>;
      })}
      </View>
    </> : null}
    {!revision && hasAnswers && journeyStep === null ? <AppButton disabled={generate.isPending || roadmap.generating} onPress={() => generate.mutate()}>
      {generate.isPending || roadmap.generating ? "Preparing practice..." : "Prepare practice suggestions"}
    </AppButton> : null}
    </View>
    <View style={page === "check-in" ? styles.content : styles.hidden} accessibilityElementsHidden={page !== "check-in"} importantForAccessibility={page === "check-in" ? "auto" : "no-hide-descendants"}>
      <PlayerCard title="Your goals">
        {roadmap.goals.length ? roadmap.goals.map((goal, index) => <Text key={index} style={[styles.body, { color: colors.text }]}>{goal}</Text>) : <Text style={[styles.body, { color: colors.mutedText }]}>Add your training goals to give your path a focus.</Text>}
        <AppButton variant="secondary" onPress={() => router.navigate("/(app)/(tabs)/profile")}>Review profile and goals</AppButton>
      </PlayerCard>
      <AnswersForm key={roadmap.version} roadmap={roadmap} onError={handleError} onSaved={data => { setPage("path"); onChanged(data); }} />
      <AppButton variant="secondary" onPress={() => setHistoryOpen(current => !current)}>{historyOpen ? "Hide history" : "View history"}</AppButton>
    </View>
    {page === "check-in" && historyOpen ? <>
      <PlayerCard title="Path history">
        <Text style={[styles.caption, { color: colors.mutedText }]}>Latest 20 paths · Earlier revisions stay saved</Text>
        {roadmap.revisions.length ? roadmap.revisions.slice(0, revisionLimit).map((entry, index) => <Pressable key={entry.id}
          accessibilityRole="button" accessibilityLabel={`${index === 0 ? "Latest path" : "Previous path"} · ${new Date(entry.createdAt).toLocaleString()}`}
          onPress={() => { setSelectedRevision(entry.id); setPage("path"); setShowDrills(true); }}
          style={[styles.historyRow, { borderColor: colors.border }]}>
          <View style={styles.historyText}><Text style={[styles.label, { color: colors.text }]}>{index === 0 ? "Latest path" : "Previous path"}</Text>
            <Text style={[styles.caption, { color: colors.mutedText }]}>{new Date(entry.createdAt).toLocaleString()}</Text></View>
          <Text style={[styles.label, { color: colors.primary }]}>View</Text>
        </Pressable>) : <Text style={[styles.body, { color: colors.mutedText }]}>Your first path will appear here once prepared.</Text>}
        {roadmap.revisions.length > revisionLimit ? <AppButton variant="secondary" onPress={() => setRevisionLimit(limit => limit + 5)}>Show more paths</AppButton> : null}
      </PlayerCard>
      <PlayerCard title="Practice evidence">
        <Text style={[styles.caption, { color: colors.mutedText }]}>Latest 100 completions · Self-reported, not verified skill measurements</Text>
        {roadmap.practice.length ? roadmap.practice.slice(0, practiceLimit).map(entry => <View key={entry.id} style={[styles.historyRow, { borderColor: colors.border }]}>
          <View style={styles.historyText}>
            <Text style={[styles.label, { color: colors.text }]}>{labels[entry.discipline]} · {entry.minutes} min</Text>
            <Text style={[styles.caption, { color: colors.mutedText }]}>{new Date(entry.completedAt).toLocaleDateString()}</Text>
            <Text style={[styles.body, { color: colors.text }]}>{entry.reflection}</Text>
          </View>
        </View>) : <Text style={[styles.body, { color: colors.mutedText }]}>Completed practice and reflections will appear here.</Text>}
        {roadmap.practice.length > practiceLimit ? <AppButton variant="secondary" onPress={() => setPracticeLimit(limit => limit + 5)}>Show more practice</AppButton> : null}
      </PlayerCard>
      {revision ? <Text style={[styles.caption, { color: colors.mutedText }]}>AI-guided · {revision.snapshot.model} · Self-reported evidence</Text> : null}
    </> : null}
    {page === "certificates" ? <><StageProgression /><PlayerCard title="Your certificates">
      <View style={[styles.certificateIcon, { backgroundColor: colors.planTrack }]}><AppIcon name="trophy" size={30} color={colors.planAccent} /></View>
      <Text style={[styles.drillTitle, { color: colors.text }]}>Your next milestone</Text>
      <Text style={[styles.label, { color: colors.planAccent }]}>Locked · Not yet assessed</Text>
      <Text style={[styles.body, { color: colors.mutedText }]}>Keep building your practice routine. Certificates require verified video evidence and approved assessment criteria; completing drills alone does not unlock an award.</Text>
      <Text style={[styles.caption, { color: colors.mutedText }]}>Current stage: Not yet assessed</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="About your assessed stage" accessibilityState={{ expanded: stageInfo }}
        onPress={() => setStageInfo(current => !current)} style={styles.textButton}>
        <Text style={[styles.label, { color: colors.planAccent }]}>{stageInfo ? "Show less" : "How assessment works"}</Text>
      </Pressable>
      {stageInfo ? <Text style={[styles.body, { color: colors.text }]}>Your check-ins and practice are self-reported. Assessed stages and certificates require verified video evidence and approved assessment criteria. Completing drills alone will not advance your stage.</Text> : null}
    </PlayerCard></> : null}
  </View>;
}

export function RoadmapScreen() {
  const { colors } = useAppTheme();
  const { state, signOut, signOutError } = useSession();
  const email = state.status === "active" && state.hasPlayerEntitlement ? state.email : "";
  const client = useQueryClient();
  const [rejected, setRejected] = useState<ApiError | null>(null);
  const key = ["player-roadmap", email] as const;
  const query = useQuery({
    queryKey: key, queryFn: ({ signal }) => getRoadmap(signal), enabled: !!email,
    retry: false, refetchOnWindowFocus: false,
  });
  useFocusEffect(useCallback(() => {
    if (email) void client.invalidateQueries({ queryKey: ["player-roadmap", email] });
  }, [email, client]));
  const error = rejected ?? query.error;
  const denied = error instanceof ApiError && (error.status === 401 || error.status === 403);
  return <AppScreen backgroundColor={colors.planBackground} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.planAccent} />}>
    {error ? <PlayerCard title={denied ? "Your access needs a review" : "Your roadmap couldn't load"}>
        <Text accessibilityRole="alert" style={[styles.body, { color: colors.error }]}>{getUserFacingErrorMessage(error)}</Text>
        <AppButton onPress={() => denied ? void signOut() : void query.refetch()}>{denied ? "Sign out" : "Try again"}</AppButton>
      </PlayerCard> : query.isSuccess ?
      <RoadmapContent key={email} roadmap={query.data} onAccessDenied={setRejected} onChanged={data => client.setQueryData(key, data)} /> :
      <ActivityIndicator accessibilityLabel="Loading your roadmap" color={colors.primary} />}
    {signOutError ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{signOutError}</Text> : null}
  </AppScreen>;
}

const styles = StyleSheet.create({
  planContent: { gap: 14 },
  content: { gap: 12 },
  heading: { gap: 4 },
  title: { fontSize: 27, lineHeight: 33, fontWeight: "700", letterSpacing: -0.5 },
  planSubtitle: { fontSize: 14, lineHeight: 21 },
  backButton: { width: 44, height: 44, justifyContent: "center" },
  backArrow: { fontSize: 26, lineHeight: 32 },
  practiceTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  practiceFill: { height: "100%", borderRadius: 3 },
  planFooter: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  certificateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  body: { fontSize: 15, lineHeight: 23 },
  caption: { fontSize: 12, lineHeight: 18 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "700" },
  group: { gap: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 46, fontSize: 14 },
  choices: { flexDirection: "row", gap: 8 },
  choice: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 10 },
  drill: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  drillTitle: { fontSize: 19, lineHeight: 26, fontWeight: "700" },
  hidden: { display: "none" },
  tabs: { flexDirection: "row", padding: 3, borderRadius: 25, gap: 3 },
  tab: { flex: 1, minHeight: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", paddingHorizontal: 3, paddingVertical: 8 },
  tabLabel: { fontSize: 13, lineHeight: 18, fontWeight: "700", textAlign: "center" },
  inlineHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  eyebrow: { fontSize: 12, lineHeight: 18, fontWeight: "800", letterSpacing: 0.7, flexShrink: 1 },
  badge: { fontSize: 12, lineHeight: 18, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  summaryRow: { flexDirection: "row", borderBottomWidth: 1, paddingBottom: 12 },
  summaryCell: { flex: 1, gap: 4 },
  focusCard: { borderRadius: 12, borderLeftWidth: 3, padding: 14, gap: 10 },
  recommendation: { fontSize: 15, lineHeight: 23, fontWeight: "500" },
  instructionSection: { borderRadius: 8, borderLeftWidth: 3, padding: 12, gap: 6 },
  textButton: { minHeight: 44, justifyContent: "center" },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, minHeight: 56 },
  historyText: { flex: 1, gap: 6 },
});
