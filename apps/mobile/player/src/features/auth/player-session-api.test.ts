import {
  exchangeGoogleIdToken,
  getGoogleSignInChallenge,
  getPlayerAccess,
} from "./player-session-api";

function respond(body: unknown, status = 200) {
  return jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe("player session API", () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalApiUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    }
  });

  it("loads the native Google challenge", async () => {
    const fetchMock = respond({ clientId: "client", nonce: "nonce", challenge: "signed" });

    await expect(getGoogleSignInChallenge()).resolves.toEqual({
      clientId: "client",
      nonce: "nonce",
      challenge: "signed",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.test/api/auth/google/native");
  });

  it("posts the ID token with its challenge and returns only the session token", async () => {
    const fetchMock = respond({
      authToken: "session-token",
      user: { userId: "u", role: "PLAYER", email: "p@example.com" },
    });

    await expect(exchangeGoogleIdToken("id-token", "signed")).resolves.toBe("session-token");
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ idToken: "id-token", challenge: "signed" });
  });

  it("keeps the registration-required code from the server", async () => {
    respond(
      { error: "Finish registration in the web app.", code: "REGISTRATION_REQUIRED" },
      403,
    );

    await expect(exchangeGoogleIdToken("id-token", "signed")).rejects.toMatchObject({
      kind: "http",
      status: 403,
      code: "REGISTRATION_REQUIRED",
    });
  });

  it("rejects a session response without a token", async () => {
    respond({ authToken: "" });

    await expect(exchangeGoogleIdToken("id-token", "signed")).rejects.toMatchObject({
      kind: "invalid-response",
    });
  });

  it("checks player access with the session bearer token", async () => {
    const fetchMock = respond({ access: "ACTIVE", email: "p@example.com", displayName: "Asha" });

    await expect(getPlayerAccess("session-token")).resolves.toEqual({
      access: "ACTIVE",
      email: "p@example.com",
      displayName: "Asha",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/api/auth/player-access");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer session-token");
  });

  it("rejects unknown access values", async () => {
    respond({ access: "ADMIN", email: "p@example.com", displayName: null });

    await expect(getPlayerAccess("session-token")).rejects.toMatchObject({
      kind: "invalid-response",
    });
  });
});
