import { StyleSheet, Text } from "react-native";

import { AppScreen } from "../../components/layout/app-screen";
import { useAppTheme } from "../../theme/use-app-theme";

export default function ApprovalScreen() {
  const { colors } = useAppTheme();

  return (
    <AppScreen>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        Application status
      </Text>
      <Text style={[styles.message, { color: colors.mutedText }]}>
        Approval status is not connected yet. This app will not query
        administrative approval queues or assume an application is approved.
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
