import { View, type ViewStyle } from "react-native";

export type AppIconName = "home" | "practice" | "analyze" | "progress" | "profile" | "settings" | "arrow" | "back" | "award";

export function AppIcon({ name, color, size = 24 }: { name: AppIconName; color: ViewStyle["borderColor"]; size?: number }) {
  const line = { borderColor: color, borderWidth: 1.8 };
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {name === "home" ? <>
        <View style={[line, { width: size * 0.53, height: size * 0.53, transform: [{ rotate: "45deg" }], borderRightWidth: 0, borderBottomWidth: 0, position: "absolute", top: size * 0.13 }]} />
        <View style={[line, { width: size * 0.56, height: size * 0.48, borderTopWidth: 0, marginTop: size * 0.24, borderRadius: 2 }]} />
      </> : null}
      {name === "practice" || name === "settings" ? <>
        <View style={[line, { width: size * 0.8, height: size * 0.8, borderRadius: size }]} />
        <View style={[line, { width: size * 0.32, height: size * 0.32, borderRadius: size, position: "absolute" }]} />
        {name === "settings" ? [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <View key={angle} style={{ position: "absolute", width: 3, height: 4, backgroundColor: color, transform: [{ rotate: `${angle}deg` }, { translateY: -size * 0.4 }] }} />
        )) : null}
      </> : null}
      {name === "analyze" ? (
        <View style={{ borderLeftWidth: size * 0.6, borderTopWidth: size * 0.36, borderBottomWidth: size * 0.36, borderLeftColor: color, borderTopColor: "transparent", borderBottomColor: "transparent", marginLeft: size * 0.12 }} />
      ) : null}
      {name === "progress" ? (
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: size * 0.12, height: size * 0.8 }}>
          {[0.4, 0.65, 1].map((height) => <View key={height} style={{ width: size * 0.18, height: size * 0.8 * height, borderRadius: 2, backgroundColor: color }} />)}
        </View>
      ) : null}
      {name === "profile" ? <>
        <View style={[line, { position: "absolute", top: 1, width: size * 0.38, height: size * 0.38, borderRadius: size }]} />
        <View style={[line, { position: "absolute", bottom: 1, width: size * 0.74, height: size * 0.38, borderTopLeftRadius: size, borderTopRightRadius: size }]} />
      </> : null}
      {name === "arrow" || name === "back" ? (
        <View style={[line, { width: size * 0.35, height: size * 0.35, borderLeftWidth: 0, borderBottomWidth: 0, transform: [{ rotate: name === "back" ? "-135deg" : "45deg" }] }]} />
      ) : null}
      {name === "award" ? <>
        <View style={[line, { width: size * 0.56, height: size * 0.56, borderRadius: size, position: "absolute", top: 1 }]} />
        <View style={[line, { width: size * 0.38, height: size * 0.37, borderTopWidth: 0, position: "absolute", bottom: 1 }]} />
      </> : null}
    </View>
  );
}
