import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { EffectCallback } from "react";

import { getPlayerSubscription, type PlayerSubscription } from "./subscription-api";
import { useSubscription } from "./use-subscription";

jest.mock("expo-router", () => ({
  useFocusEffect: (callback: EffectCallback) => {
    const { useEffect } = jest.requireActual<typeof import("react")>("react");
    useEffect(callback, [callback]);
  },
}));
jest.mock("./subscription-api", () => ({ getPlayerSubscription: jest.fn() }));

const subscription: PlayerSubscription = {
  status: "UNAVAILABLE", source: "NONE", period: null, paymentVerified: false, autoRenews: false,
  plan: {
    id: "INDIVIDUAL", name: "Individual Player", currency: "GBP", priceMonthlyMinor: 1499,
    billingCycle: "MONTHLY", profileLimit: 1, monthlyAnalysisLimit: 5,
  },
  capabilities: { purchase: false, restorePurchases: false, analysis: false },
};

describe("subscription refresh lifecycle", () => {
  afterEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  it("loads on focus and fetches fresh status when refreshed", async () => {
    jest.mocked(getPlayerSubscription).mockResolvedValue(subscription);
    const hook = await renderHook(() => useSubscription());
    await waitFor(() => expect(hook.result.current.state.status).toBe("ready"));
    await act(() => hook.result.current.retry());
    await waitFor(() => expect(getPlayerSubscription).toHaveBeenCalledTimes(2));
  });

  it("aborts requests on leaving the screen and ignores late responses", async () => {
    let resolve: ((value: PlayerSubscription) => void) | undefined;
    jest.mocked(getPlayerSubscription).mockImplementation(() => new Promise((complete) => { resolve = complete; }));
    const hook = await renderHook(() => useSubscription());
    const signal = jest.mocked(getPlayerSubscription).mock.calls[0][0];
    await hook.unmount();
    expect(signal?.aborted).toBe(true);
    await act(() => resolve?.(subscription));
  });

  it("rechecks an active subscription at the end of its period", async () => {
    jest.useFakeTimers();
    const endsAt = new Date(Date.now() + 10_000).toISOString();
    jest.mocked(getPlayerSubscription).mockResolvedValueOnce({
      ...subscription, status: "ACTIVE", source: "DEVELOPMENT_APPROVAL",
      period: { startsAt: new Date().toISOString(), endsAt },
    }).mockResolvedValueOnce({ ...subscription, status: "EXPIRED" });
    const hook = await renderHook(() => useSubscription());
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.state.status).toBe("ready");
    await act(async () => { jest.advanceTimersByTime(10_000); });
    expect(getPlayerSubscription).toHaveBeenCalledTimes(2);
    expect(hook.result.current.state).toMatchObject({ status: "ready", subscription: { status: "EXPIRED" } });
  });
});
