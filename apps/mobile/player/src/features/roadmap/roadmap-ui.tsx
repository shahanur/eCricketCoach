import type { ComponentProps } from "react";

import { AppButton } from "../../components/ui/app-button";
import { PlayerCard } from "../../components/ui/player-card";
import { useAppTheme } from "../../theme/use-app-theme";

export function useRoadmapTheme() {
  return useAppTheme("plan");
}

export function RoadmapCard(props: ComponentProps<typeof PlayerCard>) {
  return <PlayerCard {...props} tone="plan" />;
}

export function RoadmapButton(props: ComponentProps<typeof AppButton>) {
  return <AppButton {...props} tone="plan" />;
}
