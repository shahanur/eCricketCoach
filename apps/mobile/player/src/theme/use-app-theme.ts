import { useColorScheme } from "react-native";

import { colorSchemes } from "./colors";

export function useAppTheme() {
  const colorScheme = useColorScheme();

  return {
    mode: colorScheme === "dark" ? "dark" : "light",
    colors: colorSchemes[colorScheme === "dark" ? "dark" : "light"],
  } as const;
}
