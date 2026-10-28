import { ApiError } from "../../api/api-error";
import { secureSessionStorage } from "../../session/secure-session-storage";
import {
  getPlayerProfile,
  updatePlayerProfile,
  type PlayerProfile,
} from "./player-profile-api";

jest.mock("../../session/secure-session-storage", () => ({
  secureSessionStorage: { getAccessToken: jest.fn() },
}));

const profile: PlayerProfile = {
  id: "profile-1",
  displayName: "Asha Player",
  battingHandedness: "RIGHT",
  bowlingStyle: "NOT_SET",
  primaryDisciplines: ["BATTING"],
  experienceLevel: "DEVELOPING",
  goals: ["Improve footwork"],
  isComplete: true,
  version: 2,
  createdAt: "2026-10-28T12:00:00.000Z",
  updatedAt: "2026-10-28T12:05:00.000Z",
};

describe("player profile API", () => {
  const originalOrigin = process.env.EXPO_PUBLIC_API_URL;
  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
    jest.mocked(secureSessionStorage.getAccessToken).mockResolvedValue("player-session");
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalOrigin === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalOrigin;
  });

  it("loads only the authenticated player's self profile", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ profile }), { status: 200 }),
    );
    await expect(getPlayerProfile()).resolves.toEqual(profile);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/api/player/profile");
    expect(options?.headers).toHaveProperty("Authorization");
    expect(String(url)).not.toMatch(/playerId|tenantId|profileId/);
  });

  it("saves editable profile data with the server version for conflict detection", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ profile }), { status: 200 }),
    );
    const update: import("./player-profile-api").PlayerProfileUpdate = {
      version: 1,
      displayName: "Asha Player",
      battingHandedness: "LEFT" as const,
      bowlingStyle: "NOT_SET" as const,
      primaryDisciplines: ["BATTING"],
      experienceLevel: "DEVELOPING" as const,
      goals: ["Improve footwork"],
    };
    await expect(updatePlayerProfile(update)).resolves.toEqual(profile);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/api/player/profile");
    expect(options).toMatchObject({
      method: "PUT",
      headers: { "Content-Type": "application/json" },
    });
    expect(options?.headers).toHaveProperty("Authorization");
    expect(JSON.parse(String(options?.body))).toEqual(update);
  });

  it("does not make anonymous calls when secure storage has no session", async () => {
    jest.mocked(secureSessionStorage.getAccessToken).mockResolvedValue(null);
    const fetchMock = jest.spyOn(globalThis, "fetch");
    await expect(getPlayerProfile()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed profile responses and surfaces server errors", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ profile: { ...profile, version: "latest" } }), { status: 200 }),
    );
    await expect(getPlayerProfile()).rejects.toMatchObject({ kind: "invalid-response" });

    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Profile not available" }), { status: 403 }),
    );
    await expect(getPlayerProfile()).rejects.toMatchObject({ kind: "http", status: 403 });
  });

  it("rejects invalid profile edits before sending them", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch");
    await expect(updatePlayerProfile({
      version: -1,
      displayName: "",
      battingHandedness: "RIGHT",
      bowlingStyle: "NOT_SET",
      primaryDisciplines: [],
      experienceLevel: "NOT_SET",
      goals: [],
    })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
