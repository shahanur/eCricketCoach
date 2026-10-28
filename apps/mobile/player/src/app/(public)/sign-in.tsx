import { Link } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { useAppTheme } from "../../theme/use-app-theme";

export default function SignInScreen() {
  const { colors } = useAppTheme();

  return (
    <AppScreen>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        Sign-in setup is pending
      </Text>
      <Text style={[styles.message, { color: colors.mutedText }]}>
        Secure provider authentication and its server contract are not part of
        the app foundation. No credentials have been requested or sent.
      </Text>
      <Link href="/(public)/welcome" asChild>
        <AppButton variant="secondary">Back</AppButton>
      </Link>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
});
