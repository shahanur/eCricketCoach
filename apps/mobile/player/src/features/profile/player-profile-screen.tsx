import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
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
import { OpenWebAppButton } from "../web-app/open-web-app-button";
import { useSession } from "../../session/session-context";
import { useAppTheme } from "../../theme/use-app-theme";
import { useSubscription } from "../subscription/use-subscription";
import type { SubscriptionState } from "../subscription/use-subscription";
import { getPlayerDashboard } from "../dashboard/dashboard-api";
import { ProfileOverview } from "./profile-overview";
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
  onClose,
}: {
  profile: PlayerProfile;
  email: string;
  onSave: (update: PlayerProfileUpdate) => Promise<void>;
  onRefresh: () => void;
  onEdit: () => void;
  isSaving: boolean;
  saveError: string | null;
  saveConflict: boolean;
  onClose?: () => void;
}) {
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState(() => toDraft(profile));
  const [validationError, setValidationError] = useState<string | null>(null);
  const saving = useRef(false);
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

  const save = useCallback(async () => {
    if (isSaving || saving.current) return false;
    const update = getUpdate(profile, draft);
    if (!update.displayName || update.displayName.length > 80) {
      setValidationError("Enter a player name of up to 80 characters.");
      return false;
    }
    if (update.goals.length > 3 || update.goals.some((goal) => goal.length > 120)) {
      setValidationError("Add up to three goals, with no more than 120 characters each.");
      return false;
    }
    saving.current = true;
    try {
      await onSave(update);
      return true;
    } catch (error) {
      setValidationError(getUserFacingErrorMessage(error));
      return false;
    } finally {
      saving.current = false;
    }
  }, [draft, profile, isSaving, onSave]);

  const goBack = useCallback(async () => {
    if (isSaving || saving.current) return;
    if (!dirty || await save()) onClose?.();
  }, [dirty, isSaving, save, onClose]);

  useFocusEffect(useCallback(() => {
    if (!onClose) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      void goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack, onClose]));

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
      {onClose ? <View style={styles.editorHeading}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to profile" disabled={isSaving} style={styles.backAction} onPress={() => void goBack()}>
          <AppIcon name="back" color={colors.text} size={23} />
        </Pressable>
        <View style={styles.editorHeadingCopy}>
          <Text accessibilityRole="header" style={[styles.editorTitle, { color: colors.text }]}>Edit Profile</Text>
          <Text style={[styles.helper, { color: colors.mutedText }]}>Changes save when you go back.</Text>
        </View>
      </View> : null}
      <View style={[styles.editorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeading}>
          <AppIcon name="profile" color={colors.primary} size={20} />
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>Player details</Text>
        </View>
        <FieldLabel label="Player name" colors={colors} />
        <TextInput
          accessibilityLabel="Player name"
          autoCapitalize="words"
          maxLength={80}
          onChangeText={(value) => updateDraft("displayName", value)}
          placeholder="Your name"
          placeholderTextColor={colors.mutedText}
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
          value={draft.displayName}
        />
        <Text style={[styles.label, { color: colors.mutedText }]}>Account email</Text>
        <Text accessibilityLabel={`Account email: ${email}`} style={[styles.readOnly, { color: colors.mutedText }]}>
          {email}
        </Text>
      </View>
      <View style={[styles.editorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeading}>
          <AppIcon name="practice" color={colors.primary} size={20} />
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>Your game</Text>
        </View>
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
      </View>
      <View style={[styles.editorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeading}>
          <AppIcon name="list" color={colors.primary} size={20} />
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>Training goals</Text>
        </View>
        <Text style={[styles.helper, { color: colors.mutedText }]}>Add up to three goals, one per line. Keep it specific to your game.</Text>
        <TextInput
          accessibilityLabel="Training goals, one per line"
          maxLength={365}
          multiline
          onChangeText={(value) => updateDraft("goalsText", value)}
          placeholder={"For example:\nImprove my front-foot drive"}
          placeholderTextColor={colors.mutedText}
          style={[styles.input, styles.goalsInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
          textAlignVertical="top"
          value={draft.goalsText}
        />
      </View>
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
                  backgroundColor: checked ? colors.secondary : colors.background,
                  borderColor: checked ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={[styles.selectionMark, {
                borderColor: checked ? colors.primary : colors.mutedText,
                borderRadius: multiple ? 4 : 9,
                backgroundColor: checked ? colors.primary : "transparent",
              }]}>
                {checked ? <View style={[styles.selectionDot, { backgroundColor: colors.onPrimary }]} /> : null}
              </View>
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
  const overviewQuery = useQuery({
    queryKey: ["player-dashboard", email],
    queryFn: ({ signal }) => getPlayerDashboard(signal),
    enabled: email.length > 0,
    retry: false,
  });
  const updateMutation = useMutation({
    mutationFn: (update: PlayerProfileUpdate) => updatePlayerProfile(update),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey, profile);
      queryClient.setQueryData([...profileKey, "dashboard"], profile);
    },
  });

  const accessError = [profileQuery.error, overviewQuery.error,
    subscription.state.status === "error" ? subscription.state.error : null,
  ].find((error) => error instanceof ApiError && (error.status === 401 || error.status === 403));
  if (accessError) return <AppScreen>
    <FeedbackScreen
      variant="error"
      title={accessError instanceof ApiError && accessError.status === 401 ? "Please sign in again" : "Your access needs a review"}
      message={getUserFacingErrorMessage(accessError)}
      onRetry={() => void signOut()}
      retryLabel="Sign out"
    />
    {signOutError ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{signOutError}</Text> : null}
  </AppScreen>;
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
      {editing ? <ProfileEditor
          key={`${email}-${profileQuery.data.version}`}
          profile={profileQuery.data}
          email={email}
          onSave={async (update) => { await updateMutation.mutateAsync(update); }}
          onRefresh={() => void profileQuery.refetch()}
          onEdit={() => updateMutation.reset()}
          onClose={() => setEditing(false)}
          isSaving={updateMutation.isPending}
          saveError={saveError}
          saveConflict={updateMutation.error instanceof ApiError && updateMutation.error.code === "PROFILE_VERSION_CONFLICT"}
        />
      : <ProfileOverview
        profile={profileQuery.data}
        overview={overviewQuery.isError
          ? { status: "error", error: overviewQuery.error }
          : overviewQuery.data
            ? { status: "ready", data: overviewQuery.data, updatedAt: overviewQuery.dataUpdatedAt }
            : { status: "loading" }}
        onEdit={() => setEditing(true)}
        onRetry={() => void overviewQuery.refetch()}
      />}
      {signOutError ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{signOutError}</Text> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 8 },
  editorHeading: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  backAction: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  editorHeadingCopy: { flex: 1, gap: 2 },
  editorTitle: { fontSize: 23, lineHeight: 29, fontWeight: "700" },
  editorCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: 14, gap: 8, padding: 16 },
  label: { fontSize: 13, fontWeight: "600" },
  planStatus: { fontSize: 17, fontWeight: "700" },
  readOnly: { fontSize: 13, lineHeight: 19 },
  input: { borderRadius: 10, borderWidth: 1, fontSize: 14, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10 },
  goalsInput: { minHeight: 96 },
  group: { gap: 10 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { width: "48%", borderRadius: 10, borderWidth: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 8 },
  optionText: { fontSize: 12, fontWeight: "500", flexShrink: 1 },
  selectionMark: { width: 16, height: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  selectionDot: { width: 6, height: 6, borderRadius: 3 },
  helper: { fontSize: 12, lineHeight: 18 },
  error: { fontSize: 14, lineHeight: 20 },
});
