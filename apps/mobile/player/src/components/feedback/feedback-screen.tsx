import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "../ui/app-button";
import { useAppTheme } from "../../theme/use-app-theme";

export type FeedbackVariant =
  | "loading"
  | "empty"
  | "error"
  | "offline"
  | "unavailable";

type FeedbackScreenProps = {
  variant: FeedbackVariant;
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function FeedbackScreen({
  variant,
  title,
  message,
  onRetry,
  retryLabel = "Try again",
}: FeedbackScreenProps) {
  const { colors } = useAppTheme();
  const isLoading = variant === "loading";

  return (
    <View
      accessibilityLiveRegion={
        variant === "error" || variant === "offline" ? "assertive" : undefined
      }
      style={styles.container}
    >
      {isLoading ? (
        <ActivityIndicator
          accessibilityLabel={title}
          color={colors.primary}
          size="large"
        />
      ) : null}
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.text }]}
      >
        {title}
      </Text>
      <Text style={[styles.message, { color: colors.mutedText }]}>
        {message}
      </Text>
      {onRetry ? (
        <View style={styles.action}>
          <AppButton onPress={onRetry} variant="secondary">
            {retryLabel}
          </AppButton>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
    maxWidth: 420,
    textAlign: "center",
  },
  action: {
    marginTop: 24,
    minWidth: 160,
  },
});
