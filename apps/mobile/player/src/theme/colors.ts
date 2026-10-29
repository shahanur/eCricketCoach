export const colorSchemes = {
  light: {
    background: "#F3F6FB",
    surface: "#FFFFFF",
    text: "#17243B",
    mutedText: "#53647B",
    primary: "#245DB0",
    onPrimary: "#FFFFFF",
    secondary: "#E3EDFC",
    border: "#D6E0EE",
    accent: "#245DB0",
    onAccent: "#FFFFFF",
    gold: "#88620A",
    blue: "#2267A7",
    error: "#A32929",
  },
  dark: {
    background: "#0B1220",
    surface: "#142035",
    text: "#EDF3FC",
    mutedText: "#A9B9D0",
    primary: "#8CBFFF",
    onPrimary: "#10233F",
    secondary: "#203652",
    border: "#2C405B",
    accent: "#8CBFFF",
    onAccent: "#10233F",
    gold: "#F4CE63",
    blue: "#79BCF5",
    error: "#FFAAA5",
  },
} as const;

export type AppColors = (typeof colorSchemes)[keyof typeof colorSchemes];
