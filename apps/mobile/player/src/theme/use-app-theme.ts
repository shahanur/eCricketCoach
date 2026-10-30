import { useColorScheme } from "react-native";

import { colorSchemes } from "./colors";

export function useAppTheme(tone: "default" | "plan" = "default") {
  const colorScheme = useColorScheme();
  const palette = colorSchemes[colorScheme === "dark" ? "dark" : "light"];

  return {
    mode: colorScheme === "dark" ? "dark" : "light",
    colors: tone === "plan" ? {
      ...palette,
      background: palette.planBackground,
      surface: palette.planSurface,
      border: palette.planBorder,
      primary: palette.planAccent,
      onPrimary: palette.onPlanAccent,
      accent: palette.planAccent,
      onAccent: palette.onPlanAccent,
      secondary: palette.planTrack,
    } : palette,
  } as const;
}
