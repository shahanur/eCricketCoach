import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../../theme/use-app-theme";
import { AppIcon } from "./app-icon";

export function ScreenHeading({ title, subtitle, backTo, settings = false }: {
  title: string;
  subtitle?: string;
  backTo?: "/(public)/welcome" | "/(app)/(tabs)/profile";
  settings?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {backTo ? <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.navigate(backTo)}
          style={styles.action}
        ><AppIcon name="back" color={colors.text} /></Pressable> : null}
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
        {settings ? <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => router.navigate("/(app)/settings")}
          style={[styles.action, { backgroundColor: colors.secondary, borderRadius: 24 }]}
        ><AppIcon name="settings" color={colors.primary} size={20} /></Pressable> : null}
      </View>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedText }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6, paddingVertical: 8, marginBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 26, fontWeight: "800", letterSpacing: -0.7 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  action: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
