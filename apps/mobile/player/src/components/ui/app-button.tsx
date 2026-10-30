import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { useAppTheme } from "../../theme/use-app-theme";

type AppButtonProps = PropsWithChildren<{
  onPress?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  tone?: "default" | "plan";
}>;

export function AppButton({
  children,
  onPress,
  variant = "primary",
  disabled = false,
  tone = "default",
}: AppButtonProps) {
  const { colors } = useAppTheme(tone);
  const isPrimary = variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isPrimary ? colors.accent : colors.surface,
          borderColor: isPrimary ? colors.accent : colors.border,
          borderRadius: tone === "plan" ? 24 : 12,
          opacity: pressed ? 0.78 : disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: isPrimary ? colors.onAccent : colors.text },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
});
