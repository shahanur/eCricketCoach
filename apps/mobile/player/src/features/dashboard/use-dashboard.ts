import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { ApiError } from "../../api/api-error";
import { useSession } from "../../session/session-context";
import { getPlayerProfile } from "../profile/player-profile-api";
import { getPlayerSubscription } from "../subscription/subscription-api";

export type DashboardSection<T> =
  | { status: "loading" }
  | { status: "ready"; data: T; updatedAt: number }
  | { status: "error"; error: Error; cached?: { data: T; updatedAt: number } };

function toSection<T>(query: UseQueryResult<T, Error>): DashboardSection<T> {
  if (query.isError) {
    const offline = query.error instanceof ApiError &&
      (query.error.kind === "network" || query.error.kind === "timeout");
    return {
      status: "error",
      error: query.error,
      cached: offline && query.data !== undefined
        ? { data: query.data, updatedAt: query.dataUpdatedAt }
        : undefined,
    };
  }
  if (query.data !== undefined) {
    return { status: "ready", data: query.data, updatedAt: query.dataUpdatedAt };
  }
  return { status: "loading" };
}

export function useDashboard() {
  const { state } = useSession();
  const owner = state.status === "active" && state.hasPlayerEntitlement ? state.email : "";
  const queryClient = useQueryClient();
  const [focused, setFocused] = useState(false);
  const profile = useQuery({
    queryKey: ["player-profile", owner, "dashboard"],
    queryFn: ({ signal }) => getPlayerProfile(signal),
    enabled: focused && !!owner,
    staleTime: 0,
    gcTime: 300_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const subscription = useQuery({
    queryKey: ["player-subscription", owner],
    queryFn: ({ signal }) => getPlayerSubscription(signal),
    enabled: focused && !!owner,
    staleTime: 0,
    gcTime: 300_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => {
      setFocused(false);
      void queryClient.cancelQueries({ queryKey: ["player-profile", owner, "dashboard"], exact: true });
      void queryClient.cancelQueries({ queryKey: ["player-subscription", owner], exact: true });
    };
  }, [owner, queryClient]));

  const refreshProfile = () => { if (focused && owner) void profile.refetch(); };
  const refreshSubscription = () => { if (focused && owner) void subscription.refetch(); };

  useEffect(() => {
    const plan = subscription.data;
    if (!focused || !owner || plan?.status !== "ACTIVE" || !plan.period) return;
    const remaining = Date.parse(plan.period.endsAt) - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ["player-subscription", owner], exact: true });
    }, Math.min(remaining, 86_400_000));
    return () => clearTimeout(timer);
  }, [focused, owner, queryClient, subscription.data, subscription.dataUpdatedAt]);

  return {
    profile: toSection(profile),
    subscription: toSection(subscription),
    refreshing: profile.isFetching || subscription.isFetching,
    refreshProfile,
    refreshSubscription,
    refresh: () => { refreshProfile(); refreshSubscription(); },
  };
}
