import { View, type ViewStyle } from "react-native";

export type AppIconName = "home" | "practice" | "analyze" | "progress" | "profile" | "settings" | "arrow" | "back" | "award" | "bell" | "video" | "drive" | "runner" | "bulb";

export function AppIcon({ name, color, size = 24 }: { name: AppIconName; color: ViewStyle["borderColor"]; size?: number }) {
  const line = { borderColor: color, borderWidth: 1.8 };
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {name === "bulb" ? <>
        <View style={{ width: size * 0.48, height: size * 0.55, borderRadius: size, backgroundColor: color, position: "absolute", top: size * 0.12 }} />
        <View style={{ width: size * 0.22, height: size * 0.17, borderRadius: 2, backgroundColor: color, position: "absolute", top: size * 0.62 }} />
        {[-60, 0, 60].map((angle) => <View key={angle} style={{ position: "absolute", width: 1.5, height: size * 0.12, backgroundColor: color, transform: [{ rotate: `${angle}deg` }, { translateY: -size * 0.42 }] }} />)}
      </> : null}
      {name === "bell" ? <>
        <View style={[line, { width: size * 0.57, height: size * 0.62, borderTopLeftRadius: size, borderTopRightRadius: size, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }]} />
        <View style={{ width: size * 0.15, height: size * 0.1, borderRadius: size, backgroundColor: color, position: "absolute", bottom: size * 0.08 }} />
      </> : null}
      {name === "video" ? <>
        <View style={{ width: size * 0.67, height: size * 0.55, borderRadius: 4, backgroundColor: color, position: "absolute", left: 0 }} />
        <View style={{ borderRightWidth: size * 0.28, borderTopWidth: size * 0.2, borderBottomWidth: size * 0.2, borderRightColor: color, borderTopColor: "transparent", borderBottomColor: "transparent", position: "absolute", right: 0 }} />
        <View style={{ borderLeftWidth: size * 0.2, borderTopWidth: size * 0.12, borderBottomWidth: size * 0.12, borderLeftColor: "#FFFFFF", borderTopColor: "transparent", borderBottomColor: "transparent", position: "absolute", left: size * 0.27 }} />
      </> : null}
      {name === "drive" ? <>
        <View style={{ width: size * 0.27, height: size * 0.75, backgroundColor: "#0F9D58", transform: [{ rotate: "30deg" }], position: "absolute", left: size * 0.19, top: size * 0.05 }} />
        <View style={{ width: size * 0.27, height: size * 0.75, backgroundColor: "#F4B400", transform: [{ rotate: "-30deg" }], position: "absolute", right: size * 0.19, top: size * 0.05 }} />
        <View style={{ width: size * 0.71, height: size * 0.25, backgroundColor: "#4285F4", position: "absolute", bottom: size * 0.09, transform: [{ skewX: "-30deg" }] }} />
      </> : null}
      {name === "runner" ? <>
        <View style={{ position: "absolute", top: 0, left: size * 0.58, width: size * 0.2, height: size * 0.2, borderRadius: size, backgroundColor: color }} />
        {[
          [0.41, 0.24, 0.12, 0.4, 25],
          [0.25, 0.26, 0.35, 0.09, -20],
          [0.59, 0.34, 0.28, 0.09, 35],
          [0.25, 0.55, 0.12, 0.4, 35],
          [0.5, 0.55, 0.12, 0.32, -40],
        ].map(([left, top, width, height, angle], index) => <View key={index} style={{
          position: "absolute", left: size * left, top: size * top, width: size * width, height: size * height,
          borderRadius: size, backgroundColor: color, transform: [{ rotate: `${angle}deg` }],
        }} />)}
      </> : null}
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
