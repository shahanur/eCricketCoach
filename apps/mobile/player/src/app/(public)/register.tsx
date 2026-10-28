import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { BrandMark } from "../../components/brand/brand-mark";
import { ScreenHeading } from "../../components/ui/screen-heading";
import { PlayerCard, StatusBadge } from "../../components/ui/player-card";
import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { OpenWebAppButton } from "../../features/web-app/open-web-app-button";
import { useAppTheme } from "../../theme/use-app-theme";

const REGISTRATION_STEPS = [
  {
    title: "Choose your plan",
    text: "On the eCricketCoach website, open Pricing and select Register as Player on the Individual Player plan.",
  },
  {
    title: "Confirm your details",
    text: "Verify your account and complete checkout.",
  },
  {
    title: "Account review",
    text: "Our team reviews and approves new player accounts.",
  },
  {
    title: "Start training",
    text: "Once approved, return to this app and sign in with the same Google account.",
  },
] as const;

export default function RegisterScreen() {
  const { colors } = useAppTheme();

  return (
    <AppScreen>
      <View style={styles.content}>
        <ScreenHeading title="Create account" backTo="/(public)/welcome" />
        <BrandMark />
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            Create your player account
          </Text>
          <Text style={[styles.message, { color: colors.mutedText }]}>
            Registration takes just a few minutes on the eCricketCoach website.
          </Text>
        </View>
        <PlayerCard title="Made for your individual journey">
          <StatusBadge label="Individual Player" />
          <Text style={[styles.message, { color: colors.mutedText }]}>
            One player. Your own goals. Complete registration on our website, then return here after approval.
          </Text>
        </PlayerCard>

        <View accessibilityRole="list" style={styles.steps}>
          {REGISTRATION_STEPS.map(({ title, text }, index) => (
            <View key={title} style={styles.step}>
              <View style={[styles.stepBadge, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.stepNumber, { color: colors.primary }]}>{index + 1}</Text>
              </View>
              <View style={styles.stepBody}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.stepText, { color: colors.mutedText }]}>{text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <OpenWebAppButton label="Register on the website" />
          <Link href="/(public)/sign-in" asChild>
            <AppButton variant="secondary">I already have an account</AppButton>
          </Link>
          <Link href="/(public)/welcome" asChild>
            <AppButton variant="secondary">Back</AppButton>
          </Link>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 20,
    paddingVertical: 16,
  },
  intro: {
    gap: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
  },
  message: {
    fontSize: 17,
    lineHeight: 25,
  },
  steps: {
    gap: 18,
  },
  step: {
    flexDirection: "row",
    gap: 14,
    borderRadius: 14,
  },
  stepBadge: {
    alignItems: "center",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  stepNumber: {
    fontSize: 15,
    fontWeight: "800",
  },
  stepBody: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  stepText: {
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    gap: 12,
    marginTop: "auto",
  },
});
