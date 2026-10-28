import { Image, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../../theme/use-app-theme";

type BrandMarkProps = {
  size?: "small" | "large";
};

export function BrandMark({ size = "small" }: BrandMarkProps) {
  const { colors } = useAppTheme();
  const isLarge = size === "large";

  return (
    <View
      accessible
      accessibilityLabel="eCricketCoach"
      accessibilityRole="image"
      style={styles.row}
    >
      <Image
        source={require("../../../assets/icon.png")}
        style={[styles.icon, isLarge ? styles.iconLarge : styles.iconSmall]}
      />
      <Text
        style={[
          styles.wordmark,
          isLarge ? styles.wordmarkLarge : styles.wordmarkSmall,
          { color: colors.text },
        ]}
      >
        eCricket<Text style={{ color: colors.primary }}>Coach</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  icon: {
    borderRadius: 12,
  },
  iconSmall: {
    height: 32,
    width: 32,
    borderRadius: 8,
  },
  iconLarge: {
    height: 48,
    width: 48,
  },
  wordmark: {
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  wordmarkSmall: {
    fontSize: 18,
  },
  wordmarkLarge: {
    fontSize: 24,
  },
});
