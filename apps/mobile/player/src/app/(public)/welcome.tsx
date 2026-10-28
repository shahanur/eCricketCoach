import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { useAppTheme } from "../../theme/use-app-theme";

export default function WelcomeScreen() {
  const { colors } = useAppTheme();

  return (
    <AppScreen>
      <View style={styles.content}>
        <Text style={[styles.brand, { color: colors.primary }]}>
          eCricketCoach
        </Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          Your individual player space
        </Text>
        <Text style={[styles.description, { color: colors.mutedText }]}>
          A separate app for your own cricket journey. Player registration and
          sign-in will be connected after the shared identity contract is ready.
        </Text>
        <View style={styles.actions}>
          <Link href="/(public)/register" asChild>
            <AppButton>Create account</AppButton>
          </Link>
          <Link href="/(public)/sign-in" asChild>
            <AppButton variant="secondary">Sign in</AppButton>
          </Link>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 40,
  },
  brand: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 40,
  },
  description: {
    fontSize: 17,
    lineHeight: 26,
    marginTop: 16,
  },
  actions: {
    gap: 12,
    marginTop: 32,
  },
});
