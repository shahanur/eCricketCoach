export const colorSchemes = {
  light: {
    background: "#F7F9F7",
    surface: "#FFFFFF",
    text: "#17231D",
    mutedText: "#52645A",
    primary: "#176B4B",
    onPrimary: "#FFFFFF",
    secondary: "#E6F1EA",
    border: "#D5E0D9",
    error: "#A32929",
  },
  dark: {
    background: "#111A15",
    surface: "#1C2921",
    text: "#F0F5F1",
    mutedText: "#B7C7BC",
    primary: "#73C69D",
    onPrimary: "#102117",
    secondary: "#293B30",
    border: "#3A4B40",
    error: "#FFAAA5",
  },
} as const;

export type AppColors = (typeof colorSchemes)[keyof typeof colorSchemes];
