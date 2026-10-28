import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ApiError, getUserFacingErrorMessage } from "../../api/api-error";
import { FeedbackScreen } from "../../components/feedback/feedback-screen";
import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { AppIcon } from "../../components/ui/app-icon";
import { PlayerCard, StatusBadge } from "../../components/ui/player-card";
import { ScreenHeading } from "../../components/ui/screen-heading";
import { OpenWebAppButton } from "../web-app/open-web-app-button";
import { useSession } from "../../session/session-context";
import { useAppTheme } from "../../theme/use-app-theme";
import { useSubscription } from "../subscription/use-subscription";
import type { SubscriptionState } from "../subscription/use-subscription";
import {
  getPlayerProfile,
  updatePlayerProfile,
  type PlayerProfile,
  type PlayerProfileUpdate,
} from "./player-profile-api";

const disciplines = [
  { value: "BATTING", label: "Batting" },
  { value: "BOWLING", label: "Bowling" },
  { value: "KEEPING", label: "Wicketkeeping" },
  { value: "FIELDING", label: "Fielding" },
] as const;

const handednessOptions = [
  { value: "RIGHT", label: "Right-handed" },
  { value: "LEFT", label: "Left-handed" },
  { value: "NOT_SET", label: "Prefer not to say" },
] as const;

const bowlingOptions = [
  { value: "RIGHT_ARM_FAST", label: "Right-arm pace" },
  { value: "LEFT_ARM_FAST", label: "Left-arm pace" },
  { value: "RIGHT_ARM_SPIN", label: "Right-arm spin" },
  { value: "LEFT_ARM_SPIN", label: "Left-arm spin" },
  { value: "NOT_SET", label: "Not applicable" },
] as const;

const experienceOptions = [
  { value: "BEGINNER", label: "Getting started" },
  { value: "DEVELOPING", label: "Developing" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "NOT_SET", label: "Not set" },
] as const;

function getUpdate(profile: PlayerProfile, draft: Draft): PlayerProfileUpdate {
  return {
    version: profile.version,
    displayName: draft.displayName.trim(),
    battingHandedness: draft.battingHandedness,
    bowlingStyle: draft.bowlingStyle,
    primaryDisciplines: draft.primaryDisciplines,
    experienceLevel: draft.experienceLevel,
    goals: draft.goalsText
      .split(/\r?\n/)
      .map((goal) => goal.trim())
      .filter(Boolean),
  };
}

type Draft = {
  displayName: string;
  battingHandedness: PlayerProfile["battingHandedness"];
  bowlingStyle: PlayerProfile["bowlingStyle"];
  primaryDisciplines: PlayerProfile["primaryDisciplines"];
  experienceLevel: PlayerProfile["experienceLevel"];
  goalsText: string;
};

function toDraft(profile: PlayerProfile): Draft {
  return {
    displayName: profile.displayName,
    battingHandedness: profile.battingHandedness,
    bowlingStyle: profile.bowlingStyle,
    primaryDisciplines: profile.primaryDisciplines,
    experienceLevel: profile.experienceLevel,
    goalsText: profile.goals.join("\n"),
  };
}

export function ProfileEditor({
  profile,
  email,
  onSave,
  onRefresh,
  onEdit,
  isSaving,
  saveError,
  saveConflict,
}: {
  profile: PlayerProfile;
  email: string;
  onSave: (update: PlayerProfileUpdate) => Promise<void>;
  onRefresh: () => void;
  onEdit: () => void;
  isSaving: boolean;
  saveError: string | null;
  saveConflict: boolean;
}) {
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState(() => toDraft(profile));
  const [validationError, setValidationError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(profile));
  const completed = draft.primaryDisciplines.length > 0;

  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setValidationError(null);
    onEdit();
  };

  const toggleDiscipline = (value: (typeof disciplines)[number]["value"]) => {
    const next = draft.primaryDisciplines.includes(value)
      ? draft.primaryDisciplines.filter((discipline) => discipline !== value)
      : [...draft.primaryDisciplines, value];
    updateDraft("primaryDisciplines", next);
  };

  const save = async () => {
    const update = getUpdate(profile, draft);
    if (!update.displayName || update.displayName.length > 80) {
      setValidationError("Enter a player name of up to 80 characters.");
      return;
    }
    if (update.goals.length > 3 || update.goals.some((goal) => goal.length > 120)) {
      setValidationError("Add up to three goals, with no more than 120 characters each.");
      return;
    }
    await onSave(update);
  };

  const discard = () => {
    Alert.alert("Discard your changes?", "Your unsaved profile edits will be lost.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => setDraft(toDraft(profile)) },
    ]);
  };

  const refresh = () => {
    Alert.alert("Refresh your profile?", "Your unsaved edits will be lost.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Refresh", onPress: onRefresh },
    ]);
  };

  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        Your cricket profile
      </Text>
      <Text style={[styles.body, { color: colors.mutedText }]}>
        Keep your training details up to date. Your account email is managed through your sign-in provider.
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>Account email</Text>
        <Text accessibilityLabel={`Account email: ${email}`} style={[styles.readOnly, { color: colors.mutedText }]}>
          {email}
        </Text>
      </View>
      <FieldLabel label="Player name" colors={colors} />
      <TextInput
        accessibilityLabel="Player name"
        autoCapitalize="words"
        maxLength={80}
        onChangeText={(value) => updateDraft("displayName", value)}
        placeholder="Your name"
        placeholderTextColor={colors.mutedText}
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        value={draft.displayName}
      />
      <OptionGroup
        label="Your main disciplines"
        colors={colors}
        multiple
        onChange={toggleDiscipline}
        options={disciplines}
        selected={draft.primaryDisciplines}
      />
      <OptionGroup
        label="Batting hand"
        colors={colors}
        onChange={(value) => updateDraft("battingHandedness", value)}
        options={handednessOptions}
        selected={[draft.battingHandedness]}
      />
      <OptionGroup
        label="Bowling style"
        colors={colors}
        onChange={(value) => updateDraft("bowlingStyle", value)}
        options={bowlingOptions}
        selected={[draft.bowlingStyle]}
      />
      <OptionGroup
        label="Playing experience"
        colors={colors}
        onChange={(value) => updateDraft("experienceLevel", value)}
        options={experienceOptions}
        selected={[draft.experienceLevel]}
      />
      <FieldLabel label="Training goals (up to three)" colors={colors} />
      <TextInput
        accessibilityLabel="Training goals, one per line"
        maxLength={365}
        multiline
        onChangeText={(value) => updateDraft("goalsText", value)}
        placeholder={"For example:\nImprove my front-foot drive"}
        placeholderTextColor={colors.mutedText}
        style={[styles.input, styles.goalsInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        textAlignVertical="top"
        value={draft.goalsText}
      />
      <Text style={[styles.helper, { color: colors.mutedText }]}>
        {completed ? "Your profile is complete." : "Choose at least one discipline to complete your profile."}
      </Text>
      {validationError ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{validationError}</Text> : null}
      {saveError ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{saveError}</Text> : null}
      {saveConflict ? <AppButton onPress={refresh} disabled={isSaving} variant="secondary">Refresh profile</AppButton> : null}
      {dirty ? <Text accessibilityLiveRegion="polite" style={[styles.helper, { color: colors.mutedText }]}>You have unsaved changes.</Text> : null}
      <AppButton onPress={() => void save()} disabled={!dirty || isSaving}>
        {isSaving ? "Saving…" : completed ? "Save profile" : "Save progress"}
      </AppButton>
      {dirty ? <AppButton onPress={discard} disabled={isSaving} variant="secondary">Discard changes</AppButton> : null}
    </View>
  );
}

function FieldLabel({ label, colors }: { label: string; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>{label}</Text>;
}

function OptionGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
  colors,
  multiple = false,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  selected: readonly T[];
  onChange: (value: T) => void;
  colors: ReturnType<typeof useAppTheme>["colors"];
  multiple?: boolean;
}) {
  return (
    <View style={styles.group}>
      <FieldLabel label={label} colors={colors} />
      <View style={styles.options}>
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole={multiple ? "checkbox" : "radio"}
              accessibilityState={{ checked }}
              onPress={() => onChange(option.value)}
              style={[
                styles.option,
                {
                  backgroundColor: checked ? colors.secondary : colors.surface,
                  borderColor: checked ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.optionText, { color: colors.text }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PlanSummary({
  state,
  onRetry,
  onSignOut,
}: {
  state: SubscriptionState;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const { colors } = useAppTheme();
  if (state.status === "loading") {
    return <Text style={[styles.helper, { color: colors.mutedText }]}>Loading your plan…</Text>;
  }
  if (state.status === "error") {
    const expiredSession = state.error instanceof ApiError && state.error.status === 401;
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>
          We could not load your plan
        </Text>
        <Text style={[styles.helper, { color: colors.mutedText }]}>{getUserFacingErrorMessage(state.error)}</Text>
        <AppButton onPress={expiredSession ? onSignOut : onRetry} variant="secondary">
          {expiredSession ? "Sign in again" : "Refresh plan"}
        </AppButton>
      </View>
    );
  }
  const { subscription } = state;
  const active = subscription.status === "ACTIVE";
  const expired = subscription.status === "EXPIRED";
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>Your Individual Player plan</Text>
      <Text style={[styles.planStatus, { color: active ? colors.primary : colors.mutedText }]}>
        {active ? "Active" : expired ? "Expired" : "Not active"}
      </Text>
      <Text style={[styles.helper, { color: colors.mutedText }]}>
        {active ? "Your plan covers one player." : expired ? "Contact eCricketCoach to renew your plan." : "Contact eCricketCoach to review access to your plan."}
      </Text>
      {subscription.period ? (
        <Text style={[styles.helper, { color: colors.mutedText }]}>
          {active ? "Access until " : "Access ended "}
          {new Date(subscription.period.endsAt).toLocaleString()}
          {". This plan does not renew automatically."}
        </Text>
      ) : null}
      <AppButton onPress={onRetry} variant="secondary">Refresh plan</AppButton>
      <OpenWebAppButton label="Visit eCricketCoach" variant="secondary" />
    </View>
  );
}

export function PlayerProfileScreen() {
  const { colors } = useAppTheme();
  const { state, signOut, signOutError } = useSession();
  const subscription = useSubscription();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const email = state.status === "active" ? state.email : "";
  const profileKey = ["player-profile", email] as const;
  const profileQuery = useQuery({
    queryKey: profileKey,
    queryFn: ({ signal }) => getPlayerProfile(signal),
    enabled: email.length > 0,
  });
  const updateMutation = useMutation({
    mutationFn: (update: PlayerProfileUpdate) => updatePlayerProfile(update),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey, profile);
      queryClient.setQueryData([...profileKey, "dashboard"], profile);
    },
  });

  if (profileQuery.isPending) {
    return <AppScreen>
      <PlanSummary state={subscription.state} onRetry={subscription.retry} onSignOut={() => void signOut()} />
      <FeedbackScreen variant="loading" title="Loading your profile" message="Just a moment." />
    </AppScreen>;
  }
  if (profileQuery.isError) {
    const expiredSession = profileQuery.error instanceof ApiError && profileQuery.error.status === 401;
    return (
      <AppScreen>
        <PlanSummary state={subscription.state} onRetry={subscription.retry} onSignOut={() => void signOut()} />
        <FeedbackScreen
          variant="error"
          title={expiredSession ? "Please sign in again" : "We couldn't load your profile"}
          message={getUserFacingErrorMessage(profileQuery.error)}
          onRetry={expiredSession ? () => void signOut() : () => void profileQuery.refetch()}
          retryLabel={expiredSession ? "Sign in again" : "Try again"}
        />
        {signOutError ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{signOutError}</Text> : null}
      </AppScreen>
    );
  }
  const saveError = updateMutation.error instanceof ApiError &&
    updateMutation.error.code === "PROFILE_VERSION_CONFLICT"
    ? "Your profile changed on another device. Refresh it before saving again."
    : updateMutation.error
      ? getUserFacingErrorMessage(updateMutation.error)
      : null;

  return (
    <AppScreen>
      <ScreenHeading title={editing ? "Edit your profile" : "Your profile"} settings />
      {editing ? <>
        <AppButton variant="secondary" onPress={() => Alert.alert(
          "Close profile editor?",
          "Make sure you've saved any changes you want to keep.",
          [{ text: "Keep editing", style: "cancel" }, { text: "Close editor", onPress: () => setEditing(false) }],
        )}>Back to profile</AppButton>
        <ProfileEditor
        key={`${email}-${profileQuery.data.version}`}
        profile={profileQuery.data}
        email={email}
        onSave={async (update) => { await updateMutation.mutateAsync(update); }}
        onRefresh={() => void profileQuery.refetch()}
        onEdit={() => updateMutation.reset()}
        isSaving={updateMutation.isPending}
        saveError={saveError}
        saveConflict={updateMutation.error instanceof ApiError && updateMutation.error.code === "PROFILE_VERSION_CONFLICT"}
      />
      </> : <>
        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: colors.secondary, borderColor: colors.primary }]}>
            <AppIcon name="profile" color={colors.primary} size={44} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{profileQuery.data.displayName}</Text>
          <StatusBadge label="Individual Player" />
          <Text style={[styles.helper, { color: colors.mutedText }]}>{email}</Text>
        </View>
        <PlayerCard title="Your training focus">
          <Text style={[styles.body, { color: colors.mutedText }]}>
            {profileQuery.data.primaryDisciplines.length
              ? disciplines.filter(({ value }) => profileQuery.data.primaryDisciplines.includes(value)).map(({ label }) => label).join(" / ")
              : "Choose your disciplines to start shaping your journey."}
          </Text>
          <Text style={[styles.helper, { color: colors.mutedText }]}>Training preferences, not an assessed skill stage.</Text>
        </PlayerCard>
        <PlayerCard title="Your goals">
          {profileQuery.data.goals.length ? profileQuery.data.goals.map((goal, index) => (
            <View key={index} style={styles.goalRow}>
              <View style={[styles.goalDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.goal, { color: colors.text }]}>{goal}</Text>
            </View>
          )) : <Text style={[styles.body, { color: colors.mutedText }]}>Add a personal goal to give your training a focus.</Text>}
        </PlayerCard>
        <AppButton onPress={() => setEditing(true)}>{profileQuery.data.isComplete ? "Edit profile" : "Complete your profile"}</AppButton>
        <AppButton variant="secondary" onPress={() => router.navigate("/(app)/(tabs)/progress")}>View your roadmap</AppButton>
      </>}
      <PlanSummary state={subscription.state} onRetry={subscription.retry} onSignOut={() => void signOut()} />
      <AppButton variant="secondary" onPress={() => router.navigate("/(app)/subscription")}>Subscription details</AppButton>
      {signOutError ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{signOutError}</Text> : null}
      <AppButton onPress={() => void signOut()} variant="secondary">Sign out</AppButton>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, gap: 14, paddingVertical: 8 },
  title: { fontSize: 28, fontWeight: "800" },
  body: { fontSize: 16, lineHeight: 24 },
  card: { borderWidth: 1, borderRadius: 14, gap: 8, padding: 16 },
  label: { fontSize: 15, fontWeight: "700" },
  planStatus: { fontSize: 17, fontWeight: "700" },
  readOnly: { fontSize: 16, lineHeight: 24 },
  input: { borderRadius: 12, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12 },
  goalsInput: { minHeight: 110 },
  group: { gap: 10 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { borderRadius: 18, borderWidth: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 8 },
  optionText: { fontSize: 14, fontWeight: "600" },
  helper: { fontSize: 14, lineHeight: 20 },
  error: { fontSize: 14, lineHeight: 20 },
  identity: { alignItems: "center", gap: 10, paddingVertical: 16 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  goalRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  goalDot: { height: 7, width: 7, borderRadius: 4 },
  goal: { fontSize: 15, lineHeight: 22, flex: 1 },
});
