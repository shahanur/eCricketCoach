import { secureSessionStorage } from "../../session/secure-session-storage";
import { dashboardSchema, getPlayerDashboard } from "./dashboard-api";

jest.mock("../../session/secure-session-storage", () => ({
  secureSessionStorage: { getAccessToken: jest.fn() },
}));

const empty = { source: "NONE", progress: null, focus: null, notification: null };
const demo = {
  source: "DEVELOPMENT_SEED", progress: { percent: 72, stage: "Developing Player" },
  focus: { title: "Front Foot Drive Drill", discipline: "Batting", minutes: 15, description: "Sample drill" },
  notification: "Sample notification",
};

describe("self dashboard API", () => {
  const origin = process.env.EXPO_PUBLIC_API_URL;
  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
    jest.mocked(secureSessionStorage.getAccessToken).mockResolvedValue("player-session");
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (origin === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = origin;
  });
  it("uses the self endpoint with authorization and cancellation, not a supplied owner", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ dashboard: demo })));
    await expect(getPlayerDashboard(new AbortController().signal)).resolves.toEqual(demo);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.test/api/player/dashboard");
    expect(fetchMock.mock.calls[0][1]?.headers).toHaveProperty("Authorization");
    expect(fetchMock.mock.calls[0][1]?.signal).toBeDefined();
  });
  it("rejects malformed or out-of-range data rather than manufacturing progress", () => {
    expect(dashboardSchema.safeParse(empty).success).toBe(true);
    for (const value of [
      { ...demo, progress: { ...demo.progress, percent: 101 } },
      { ...demo, progress: { ...demo.progress, percent: -1 } },
      { ...demo, focus: { ...demo.focus, minutes: 0 } },
      { ...demo, source: "NONE" },
    ]) expect(dashboardSchema.safeParse(value).success).toBe(false);
  });
  it("does not make anonymous calls or replace rejected calls with fixtures", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 403 }));
    await expect(getPlayerDashboard()).rejects.toMatchObject({ status: 403 });
    fetchMock.mockClear();
    jest.mocked(secureSessionStorage.getAccessToken).mockResolvedValue(null);
    await expect(getPlayerDashboard()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
