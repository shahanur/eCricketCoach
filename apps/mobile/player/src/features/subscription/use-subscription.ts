import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { getPlayerSubscription, type PlayerSubscription } from "./subscription-api";

export type SubscriptionState =
  | { status: "loading" }
  | { status: "ready"; subscription: PlayerSubscription }
  | { status: "error"; error: unknown };

export function useSubscription() {
  const [state, setState] = useState<SubscriptionState>({ status: "loading" });
  const refresh = useRef<(() => void) | null>(null);
  const retry = useCallback(() => refresh.current?.(), []);

  useFocusEffect(useCallback(() => {
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      controller?.abort();
      clearTimeout(timer);
      const request = new AbortController();
      controller = request;
      setState({ status: "loading" });
      void getPlayerSubscription(request.signal).then((subscription) => {
        if (request.signal.aborted) return;
        setState({ status: "ready", subscription });
        if (subscription.status === "ACTIVE" && subscription.period) {
          const remaining = Date.parse(subscription.period.endsAt) - Date.now();
          timer = setTimeout(load, Math.max(1000, Math.min(remaining, 86_400_000)));
        }
      }).catch((error: unknown) => {
        if (!request.signal.aborted) setState({ status: "error", error });
      });
    };
    refresh.current = load;
    load();
    return () => {
      refresh.current = null;
      controller?.abort();
      clearTimeout(timer);
    };
  }, []));

  return { state, retry };
}
