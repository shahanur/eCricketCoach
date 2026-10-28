export const colorSchemes = {
  light: {
    background: "#F3F8F5",
    surface: "#FFFFFF",
    text: "#102A1D",
    mutedText: "#53695E",
    primary: "#146C42",
    onPrimary: "#FFFFFF",
    secondary: "#E0F3E7",
    border: "#D7E6DD",
    accent: "#48E58C",
    onAccent: "#052B18",
    gold: "#88620A",
    blue: "#2267A7",
    error: "#A32929",
  },
  dark: {
    background: "#061710",
    surface: "#0D241B",
    text: "#F0F8F3",
    mutedText: "#A9C0B3",
    primary: "#48E58C",
    onPrimary: "#052B18",
    secondary: "#17382A",
    border: "#244536",
    accent: "#48E58C",
    onAccent: "#052B18",
    gold: "#F4CE63",
    blue: "#79BCF5",
    error: "#FFAAA5",
  },
} as const;

export type AppColors = (typeof colorSchemes)[keyof typeof colorSchemes];
