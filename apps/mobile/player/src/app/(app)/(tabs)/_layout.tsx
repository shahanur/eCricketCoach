import { Tabs } from "expo-router";

import { playerTabRoutes } from "../../../navigation/player-tabs";
import { AppIcon } from "../../../components/ui/app-icon";
import { useAppTheme } from "../../../theme/use-app-theme";

export default function PlayerTabsLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: 64,
          paddingTop: 6,
        },
      }}
    >
      {playerTabRoutes.map(({ name, title }) => (
        <Tabs.Screen key={name} name={name} options={{
          title,
          tabBarIcon: ({ color }) => <AppIcon name={name === "practice" ? "runner" : name === "analyze" ? "analyze" : name === "progress" ? "award" : name === "profile" ? "profile" : "home"} color={color} size={22} />,
        }} />
      ))}
    </Tabs>
  );
}
