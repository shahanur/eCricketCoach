import { StyleSheet, Text } from "react-native";

import { FeedbackScreen } from "../../components/feedback/feedback-screen";
import { AppScreen } from "../../components/layout/app-screen";
import { useAppTheme } from "../../theme/use-app-theme";

type UnavailableScreenProps = {
  title: string;
  message: string;
};

export function UnavailableScreen({
  title,
  message,
}: UnavailableScreenProps) {
  const { colors } = useAppTheme();

  return (
    <AppScreen>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>
        eCricketCoach Player
      </Text>
      <FeedbackScreen
        variant="unavailable"
        title={`${title} is not available yet`}
        message={message}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
