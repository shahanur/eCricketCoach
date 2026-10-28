import { Link } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { useAppTheme } from "../../theme/use-app-theme";

export default function RegisterScreen() {
  const { colors } = useAppTheme();

  return (
    <AppScreen>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        Registration is not available yet
      </Text>
      <Text style={[styles.message, { color: colors.mutedText }]}>
        Player registration depends on verified identity, purchase, and
        approval contracts. This screen does not collect personal or payment
        information.
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
