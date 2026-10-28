import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "../../components/ui/app-button";
import { useAppTheme } from "../../theme/use-app-theme";
import { useOpenWebApp } from "./use-open-web-app";

type OpenWebAppButtonProps = {
  label: string;
  variant?: "primary" | "secondary";
};

export function OpenWebAppButton({
  label,
  variant = "primary",
}: OpenWebAppButtonProps) {
  const { colors } = useAppTheme();
  const { isAvailable, open, error } = useOpenWebApp();

  if (!isAvailable) {
    return (
      <Text style={[styles.notice, { color: colors.mutedText }]}>
        Please visit the eCricketCoach website on your phone or computer.
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      <AppButton onPress={() => void open()} variant={variant}>
        {label}
      </AppButton>
      {error ? (
        <Text
          accessibilityLiveRegion="assertive"
          style={[styles.notice, { color: colors.error }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  notice: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
});
