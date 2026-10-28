import { StyleSheet, Text, View } from "react-native";

import { BrandMark } from "../../components/brand/brand-mark";
import { AppScreen } from "../../components/layout/app-screen";
import { useAppTheme } from "../../theme/use-app-theme";

type ComingSoonScreenProps = {
  title: string;
  message: string;
};

export function ComingSoonScreen({ title, message }: ComingSoonScreenProps) {
  const { colors } = useAppTheme();

  return (
    <AppScreen>
      <BrandMark />
      <View style={styles.body}>
        <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>Coming soon</Text>
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.message, { color: colors.mutedText }]}>{message}</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 420,
    textAlign: "center",
  },
});
