import { Link, router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { AppIcon } from "../../components/ui/app-icon";
import { GoogleSignInButton } from "../../features/auth/google-sign-in-button";
import { useSignIn } from "../../features/auth/use-sign-in";
import { OpenWebAppButton } from "../../features/web-app/open-web-app-button";
import { useAppTheme } from "../../theme/use-app-theme";

export default function SignInScreen() {
  const { colors } = useAppTheme();
  const { signingIn, feedback, signInWithGoogle } = useSignIn();

  return (
    <AppScreen>
      <View style={styles.content}>
        <View style={styles.navigation}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.navigate("/(public)/welcome")}
            style={styles.back}
          ><AppIcon name="back" color={colors.text} size={22} /></Pressable>
          <Link href="/(public)/register" style={[styles.textLink, { color: colors.primary }]}>Create account</Link>
        </View>
        <View style={styles.intro}>
          <View style={styles.cardHeading}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
              Welcome back 👋
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedText }]}>
              Log in to continue your cricket journey.
            </Text>
          </View>
        </View>

        <View style={styles.social}>
          <GoogleSignInButton
            disabled={signingIn}
            onPress={() => void signInWithGoogle()}
          />
          <AppButton disabled variant="secondary">Continue with Apple</AppButton>
          <Text style={[styles.availability, { color: colors.mutedText }]}>
            Apple sign-in is not available in this release.
          </Text>

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
          <Text style={[styles.body, { color: colors.mutedText }]}>
            Don&apos;t have an account?
          </Text>
          <Link href="/(public)/register" style={[styles.textLink, { color: colors.primary }]}>Sign up</Link>
        </View>
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

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 28,
    paddingVertical: 8,
  },
  navigation: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -10 },
  textLink: { fontSize: 14, fontWeight: "700", paddingVertical: 14, paddingHorizontal: 4, minHeight: 48 },
  intro: { gap: 14, paddingTop: 16 },
  social: { gap: 14 },
  availability: { fontSize: 12, lineHeight: 18 },
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
  body: {
    fontSize: 15,
    lineHeight: 22,
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
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    columnGap: 6,
  },
});
