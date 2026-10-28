import Constants from "expo-constants";
import { Link } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { BrandMark } from "../../components/brand/brand-mark";
import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { ScreenHeading } from "../../components/ui/screen-heading";
import { AppIcon } from "../../components/ui/app-icon";
import { GoogleSignInButton } from "../../features/auth/google-sign-in-button";
import type { AuthProvider } from "../../features/auth/auth-providers";
import { useSignIn } from "../../features/auth/use-sign-in";
import { OpenWebAppButton } from "../../features/web-app/open-web-app-button";
import { useAppTheme } from "../../theme/use-app-theme";

export default function SignInScreen() {
  const { colors } = useAppTheme();
  const { options, retryOptions, signingIn, feedback, signInWithGoogle } = useSignIn();
  const version = Constants.expoConfig?.version;

  return (
    <AppScreen>
      <View style={styles.content}>
        <ScreenHeading title="Log in" backTo="/(public)/welcome" />
        <View style={styles.header}>
          <BrandMark size="large" />
          <Text style={[styles.tagline, { color: colors.mutedText }]}>
            Welcome back. Sign in to pick up your training where you left off.
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeading}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
              Welcome back
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedText }]}>
              Use the account linked to your Individual Player plan.
            </Text>
          </View>
          <View style={[styles.accountNotice, { backgroundColor: colors.secondary }]}>
            <AppIcon name="profile" color={colors.primary} size={22} />
            <Text style={[styles.body, { color: colors.mutedText, flex: 1 }]}>
              Your Google account keeps your player profile private and your training together.
            </Text>
          </View>

          {options.status === "loading" ? (
            <StatusRow label="Connecting…" />
          ) : null}

          {options.status === "error" ? (
            <View style={styles.stack}>
              <Notice message={options.message} />
              <AppButton onPress={retryOptions} variant="secondary">
                Try again
              </AppButton>
            </View>
          ) : null}

          {options.status === "ready" && options.deviceGoogle ? (
            <GoogleSignInButton
              disabled={signingIn}
              onPress={() => void signInWithGoogle()}
            />
          ) : null}

          {options.status === "ready" &&
          !options.deviceGoogle &&
          options.websiteProviders.length > 0 ? (
            <View style={styles.stack}>
              <Text style={[styles.body, { color: colors.mutedText }]}>
                Sign in with {formatProviders(options.websiteProviders)} on the
                eCricketCoach website.
              </Text>
              <OpenWebAppButton label="Continue on the website" />
            </View>
          ) : null}

          {options.status === "ready" &&
          !options.deviceGoogle &&
          options.websiteProviders.length === 0 ? (
            <View style={styles.stack}>
              <Notice message="Sign-in is temporarily unavailable. Please try again shortly." />
              <AppButton onPress={retryOptions} variant="secondary">
                Try again
              </AppButton>
            </View>
          ) : null}

          {signingIn ? <StatusRow label="Signing you in…" /> : null}

          {feedback ? (
            <View style={styles.stack}>
              <Notice message={feedback.message} />
              {feedback.kind === "registration-required" ? (
                <OpenWebAppButton label="Register on the website" variant="secondary" />
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Text style={[styles.body, styles.centered, { color: colors.mutedText }]}>
            New to eCricketCoach?
          </Text>
          <Link href="/(public)/register" asChild>
            <AppButton variant="secondary">Register as player</AppButton>
          </Link>
          <Link href="/(public)/welcome" asChild>
            <AppButton variant="secondary">Back</AppButton>
          </Link>
        </View>

        <Text style={[styles.footer, { color: colors.mutedText }]}>
          {version ? `Secure sign-in · v${version}` : "Secure sign-in"}
        </Text>
      </View>
    </AppScreen>
  );
}

function StatusRow({ label }: { label: string }) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityLiveRegion="polite" style={styles.statusRow}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[styles.body, { color: colors.mutedText }]}>{label}</Text>
    </View>
  );
}

function Notice({ message }: { message: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityLiveRegion="assertive"
      style={[styles.notice, { borderColor: colors.error }]}
    >
      <Text style={[styles.body, { color: colors.error }]}>{message}</Text>
    </View>
  );
}

function formatProviders(providers: AuthProvider[]): string {
  if (providers.length === 1) return providers[0];
  if (providers.length === 2) return `${providers[0]} or ${providers[1]}`;
  return `${providers.slice(0, -1).join(", ")} or ${providers.at(-1)}`;
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 24,
    paddingVertical: 16,
  },
  header: {
    alignItems: "center",
    gap: 12,
  },
  tagline: {
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 16,
    padding: 20,
  },
  cardHeading: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  stack: {
    gap: 12,
  },
  accountNotice: { borderRadius: 12, padding: 14, gap: 12, flexDirection: "row", alignItems: "center" },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  centered: {
    textAlign: "center",
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    paddingVertical: 4,
  },
  notice: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actions: {
    gap: 12,
  },
  footer: {
    fontSize: 13,
    textAlign: "center",
  },
});
