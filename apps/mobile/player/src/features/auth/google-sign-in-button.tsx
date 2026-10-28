import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../../theme/use-app-theme";

type GoogleSignInButtonProps = {
  onPress: () => void;
  disabled?: boolean;
};

const GOOGLE_BLUE = "#4285F4";

export function GoogleSignInButton({ onPress, disabled = false }: GoogleSignInButtonProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityLabel="Continue with Google"
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.78 : disabled ? 0.55 : 1,
        },
      ]}
    >
      <View style={styles.mark}>
        <Text style={styles.markText}>G</Text>
      </View>
      <Text style={[styles.label, { color: colors.text }]}>Continue with Google</Text>
      <Text style={[styles.arrow, { color: colors.primary }]}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  mark: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#DADCE0",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  markText: {
    color: GOOGLE_BLUE,
    fontSize: 16,
    fontWeight: "800",
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  arrow: {
    fontSize: 18,
    fontWeight: "700",
  },
});
