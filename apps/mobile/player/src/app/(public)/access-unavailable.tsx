import { StyleSheet, Text } from "react-native";

import { AppScreen } from "../../components/layout/app-screen";
import { useAppTheme } from "../../theme/use-app-theme";

export default function AccessUnavailableScreen() {
  const { colors } = useAppTheme();

  return (
    <AppScreen>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        Player access is not confirmed
      </Text>
      <Text style={[styles.message, { color: colors.mutedText }]}>
        Protected player features remain closed until the server confirms
        account approval and entitlement.
      </Text>
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
  },
});
