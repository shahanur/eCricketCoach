import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../../theme/use-app-theme";

export function PlayerCard({ title, children }: PropsWithChildren<{ title?: string }>) {
  const { colors } = useAppTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    {title ? <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
    {children}
  </View>;
}

export function StatusBadge({ label }: { label: string }) {
  const { colors } = useAppTheme();
  return <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
    <Text style={[styles.badgeText, { color: colors.primary }]}>{label}</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 12 },
  title: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  badgeText: { fontSize: 12, fontWeight: "700" },
});
