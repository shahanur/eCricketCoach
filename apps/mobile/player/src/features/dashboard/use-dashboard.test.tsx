import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { EffectCallback, PropsWithChildren } from "react";

import { ApiError } from "../../api/api-error";
import { useSession } from "../../session/session-context";
import type { SessionState } from "../../session/session-state";
import { getPlayerProfile, type PlayerProfile } from "../profile/player-profile-api";
import { getPlayerSubscription, type PlayerSubscription } from "../subscription/subscription-api";
import { useDashboard } from "./use-dashboard";
import { getPlayerDashboard } from "./dashboard-api";

let mockFocused = true;
jest.mock("expo-router", () => ({
  useFocusEffect: (callback: EffectCallback) => {
    const { useEffect } = jest.requireActual<typeof import("react")>("react");
    const focused = mockFocused;
    useEffect(() => focused ? callback() : undefined, [callback, focused]);
  },
}));
jest.mock("../../session/session-context", () => ({ useSession: jest.fn() }));
jest.mock("../profile/player-profile-api", () => ({ getPlayerProfile: jest.fn() }));
jest.mock("../subscription/subscription-api", () => ({ getPlayerSubscription: jest.fn() }));
jest.mock("./dashboard-api", () => ({ getPlayerDashboard: jest.fn() }));

const profile: PlayerProfile = {
  id: "self", displayName: "Asha", battingHandedness: "RIGHT", bowlingStyle: "NOT_SET",
  primaryDisciplines: ["BATTING"], experienceLevel: "DEVELOPING", goals: ["Footwork"],
  isComplete: true, version: 1, createdAt: "2026-10-28T12:00:00.000Z", updatedAt: "2026-10-28T12:00:00.000Z",
};
const subscription: PlayerSubscription = {
  status: "UNAVAILABLE", source: "NONE", period: null, paymentVerified: false, autoRenews: false,
  plan: {
    id: "INDIVIDUAL", name: "Individual Player", currency: "GBP", priceMonthlyMinor: 1499,
    billingCycle: "MONTHLY", profileLimit: 1, monthlyAnalysisLimit: 5,
  },
  capabilities: { purchase: false, restorePurchases: false, analysis: false },
};

function session(state: SessionState) {
  jest.mocked(useSession).mockReturnValue({
    state, signOut: jest.fn(), signOutError: null, restoreError: null,
    retryRestore: jest.fn(), completeSignIn: jest.fn(),
  });
}

describe("dashboard fetching and isolation", () => {
  let client: QueryClient;
  const Wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  beforeEach(() => {
    mockFocused = true;
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    session({ status: "active", email: "asha@example.test", displayName: "Asha", hasPlayerEntitlement: true });
    jest.mocked(getPlayerProfile).mockResolvedValue(profile);
    jest.mocked(getPlayerSubscription).mockResolvedValue(subscription);
    jest.mocked(getPlayerDashboard).mockResolvedValue({ source: "NONE", progress: null, focus: null, notification: null });
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  it("fetches each verified contract once, refreshes both, and reflects saved profile cache updates", async () => {
    const hook = await renderHook(() => useDashboard(), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.profile.status).toBe("ready"));
    expect(getPlayerProfile).toHaveBeenCalledTimes(1);
    expect(getPlayerSubscription).toHaveBeenCalledTimes(1);
    expect(getPlayerDashboard).toHaveBeenCalledTimes(1);
    await act(() => hook.result.current.refresh());
    await waitFor(() => expect(getPlayerProfile).toHaveBeenCalledTimes(2));
    expect(getPlayerSubscription).toHaveBeenCalledTimes(2);
    expect(getPlayerDashboard).toHaveBeenCalledTimes(2);
    await act(() => client.setQueryData(["player-profile", "asha@example.test", "dashboard"], { ...profile, goals: ["New goal"] }));
    await waitFor(() => expect(hook.result.current.profile).toMatchObject({ data: { goals: ["New goal"] } }));
  });

  it("keeps partial failures separate and retries only the requested section", async () => {
    jest.mocked(getPlayerSubscription).mockRejectedValue(new ApiError("failed", "http", 500));
    const hook = await renderHook(() => useDashboard(), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.subscription.status).toBe("error"));
    expect(hook.result.current.profile.status).toBe("ready");
    jest.mocked(getPlayerSubscription).mockResolvedValue(subscription);
    await act(() => hook.result.current.refreshSubscription());
    await waitFor(() => expect(hook.result.current.subscription.status).toBe("ready"));
    expect(getPlayerProfile).toHaveBeenCalledTimes(1);
    expect(getPlayerSubscription).toHaveBeenCalledTimes(2);
  });

  it.each(["network", "timeout"] as const)("marks a cached snapshot as stale on %s failure", async (kind) => {
    const hook = await renderHook(() => useDashboard(), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.profile.status).toBe("ready"));
    jest.mocked(getPlayerProfile).mockRejectedValue(new ApiError("offline", kind));
    await act(() => hook.result.current.refreshProfile());
    await waitFor(() => expect(hook.result.current.profile.status).toBe("error"));
    expect(hook.result.current.profile).toMatchObject({ cached: { data: profile } });
  });

  it.each([401, 403, 500])("does not display cached data as a fallback for HTTP %s", async (status) => {
    const hook = await renderHook(() => useDashboard(), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.profile.status).toBe("ready"));
    jest.mocked(getPlayerProfile).mockRejectedValue(new ApiError("failed", "http", status));
    await act(() => hook.result.current.refreshProfile());
    await waitFor(() => expect(hook.result.current.profile.status).toBe("error"));
    expect(hook.result.current.profile).not.toHaveProperty("cached.data");
  });

  it("cancels both requests on blur, ignores late results, and fetches again on focus", async () => {
    let resolveProfile: ((value: PlayerProfile) => void) | undefined;
    jest.mocked(getPlayerProfile).mockImplementationOnce(() => new Promise((resolve) => { resolveProfile = resolve; }));
    jest.mocked(getPlayerSubscription).mockImplementationOnce(() => new Promise(() => {}));
    jest.mocked(getPlayerDashboard).mockImplementationOnce(() => new Promise(() => {}));
    const hook = await renderHook(() => useDashboard(), { wrapper: Wrapper });
    const profileSignal = jest.mocked(getPlayerProfile).mock.calls[0][0];
    const planSignal = jest.mocked(getPlayerSubscription).mock.calls[0][0];
    const dashboardSignal = jest.mocked(getPlayerDashboard).mock.calls[0][0];
    mockFocused = false;
    await hook.rerender({});
    expect(profileSignal?.aborted).toBe(true);
    expect(planSignal?.aborted).toBe(true);
    expect(dashboardSignal?.aborted).toBe(true);
    await act(() => resolveProfile?.({ ...profile, displayName: "Late response" }));
    expect(hook.result.current.profile.status).toBe("loading");
    mockFocused = true;
    await hook.rerender({});
    await waitFor(() => expect(hook.result.current.profile).toMatchObject({ data: { displayName: "Asha" } }));
    expect(getPlayerProfile).toHaveBeenCalledTimes(2);
    await hook.unmount();
  });

  it("never reuses another account's cache, even when the new account fails to load", async () => {
    const hook = await renderHook(() => useDashboard(), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.profile.status).toBe("ready"));
    session({ status: "active", email: "ben@example.test", displayName: "Ben", hasPlayerEntitlement: true });
    jest.mocked(getPlayerProfile).mockRejectedValue(new ApiError("offline", "network"));
    jest.mocked(getPlayerSubscription).mockRejectedValue(new ApiError("offline", "network"));
    await hook.rerender({});
    expect(hook.result.current.profile).not.toMatchObject({ data: profile });
    await waitFor(() => expect(hook.result.current.profile.status).toBe("error"));
    expect(hook.result.current.profile).not.toHaveProperty("cached.data");
    expect(hook.result.current.subscription).not.toHaveProperty("cached.data");
    expect(client.getQueryData(["player-profile", "asha@example.test", "dashboard"])).toEqual(profile);
  });

  it("does not cancel the profile editor's independent request when Home loses focus", async () => {
    jest.mocked(getPlayerProfile).mockImplementation(() => new Promise(() => {}));
    const hook = await renderHook(() => ({
      dashboard: useDashboard(),
      editorProfile: useQuery({
        queryKey: ["player-profile", "asha@example.test"],
        queryFn: ({ signal }) => getPlayerProfile(signal),
      }),
    }), { wrapper: Wrapper });
    await waitFor(() => expect(getPlayerProfile).toHaveBeenCalledTimes(2));
    mockFocused = false;
    await hook.rerender({});
    expect(hook.result.current.editorProfile.fetchStatus).toBe("fetching");
    const signals = jest.mocked(getPlayerProfile).mock.calls.map(([signal]) => signal);
    expect(signals.some((signal) => signal?.aborted)).toBe(true);
    expect(signals.some((signal) => !signal?.aborted)).toBe(true);
    await hook.unmount();
  });

  it.each<SessionState>([
    { status: "pendingApproval" },
    { status: "signedOut" },
    { status: "active", email: "asha@example.test", displayName: null, hasPlayerEntitlement: false },
  ])("does not fetch for gated sessions: $status", async (state) => {
    session(state);
    const hook = await renderHook(() => useDashboard(), { wrapper: Wrapper });
    expect(getPlayerProfile).not.toHaveBeenCalled();
    expect(getPlayerSubscription).not.toHaveBeenCalled();
    await hook.unmount();
  });

  it("rechecks entitlement at the access-period boundary without repeated polling", async () => {
    jest.useFakeTimers();
    const startsAt = new Date(Date.now() - 10_000).toISOString();
    const endsAt = new Date(Date.now() + 10_000).toISOString();
    jest.mocked(getPlayerSubscription).mockResolvedValueOnce({
      ...subscription, status: "ACTIVE", source: "DEVELOPMENT_APPROVAL", period: { startsAt, endsAt },
    }).mockResolvedValueOnce({
      ...subscription, status: "EXPIRED", source: "DEVELOPMENT_APPROVAL", period: { startsAt, endsAt },
    });
    const hook = await renderHook(() => useDashboard(), { wrapper: Wrapper });
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
    expect(hook.result.current.subscription).toMatchObject({ data: { status: "ACTIVE" } });
    await act(async () => { await jest.advanceTimersByTimeAsync(10_000); });
    expect(hook.result.current.subscription).toMatchObject({ data: { status: "EXPIRED" } });
    await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
    expect(getPlayerSubscription).toHaveBeenCalledTimes(2);
    await hook.unmount();
  });
});
