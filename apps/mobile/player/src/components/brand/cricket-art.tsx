import { StyleSheet, View } from "react-native";

import { useAppTheme } from "../../theme/use-app-theme";

export function CricketArt({ compact = false }: { compact?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.scene, { backgroundColor: colors.secondary, height: compact ? 150 : 260 }]}>
      <View style={[styles.orbit, { borderColor: colors.primary }]} />
      <View style={[styles.orbit, styles.outerOrbit, { borderColor: colors.primary }]} />
      <View style={[styles.pitch, { borderColor: colors.border, backgroundColor: colors.surface }]} />
      <View style={styles.stumps}>
        {[0, 1, 2].map((key) => <View key={key} style={[styles.stump, { backgroundColor: colors.primary }]} />)}
      </View>
      <View style={[styles.bat, { backgroundColor: colors.gold }]}>
        <View style={[styles.handle, { backgroundColor: colors.text }]} />
        <View style={[styles.batStripe, { backgroundColor: colors.primary }]} />
      </View>
      <View style={[styles.ball, { backgroundColor: colors.primary }]}>
        <View style={[styles.seam, { borderColor: colors.onPrimary }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { width: "100%", overflow: "hidden", borderRadius: 24, alignItems: "center", justifyContent: "center" },
  orbit: { position: "absolute", width: 340, height: 150, borderWidth: 2, borderRadius: 180, transform: [{ rotate: "-26deg" }], opacity: 0.35 },
  outerOrbit: { width: 410, height: 210, opacity: 0.16 },
  pitch: { position: "absolute", width: 90, height: 220, borderWidth: 1, borderRadius: 32, transform: [{ rotate: "24deg" }] },
  stumps: { position: "absolute", flexDirection: "row", gap: 8, bottom: 30, left: "30%" },
  stump: { width: 4, height: 55, borderRadius: 4 },
  bat: { width: 35, height: 112, borderRadius: 9, transform: [{ rotate: "35deg" }] },
  handle: { width: 12, height: 45, borderRadius: 6, position: "absolute", top: -38, left: 11 },
  batStripe: { height: 20, width: 35, position: "absolute", top: 28 },
  ball: { width: 38, height: 38, borderRadius: 19, position: "absolute", right: "20%", bottom: "22%", overflow: "hidden" },
  seam: { borderWidth: 1, borderStyle: "dashed", height: 42, width: 15, borderRadius: 10, alignSelf: "center", transform: [{ rotate: "-25deg" }] },
});
