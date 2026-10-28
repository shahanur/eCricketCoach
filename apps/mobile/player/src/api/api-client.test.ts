import { z } from "zod";

import { ApiError } from "./api-error";
import { requestJson } from "./api-client";

describe("requestJson", () => {
  const originalApiOrigin = process.env.EXPO_PUBLIC_API_URL;
  const fetchMock = jest.spyOn(globalThis, "fetch");

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
  });

  afterEach(() => {
    fetchMock.mockReset();
    if (originalApiOrigin === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = originalApiOrigin;
    }
  });

  afterAll(() => {
    fetchMock.mockRestore();
  });

  it("validates the response DTO and sends the bearer token centrally", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "player-1" }), { status: 200 }),
    );

    await expect(
      requestJson({
        path: "/api/player/me",
        accessToken: "session-token",
        responseSchema: z.object({ id: z.string() }),
      }),
    ).resolves.toEqual({ id: "player-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/player/me",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer session-token",
        }),
      }),
    );
  });

  it("rejects a response that does not match the declared DTO", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 12 }), { status: 200 }),
    );

    await expect(
      requestJson({
        path: "/api/player/me",
        responseSchema: z.object({ id: z.string() }),
      }),
    ).rejects.toMatchObject({
      kind: "invalid-response",
    } satisfies Partial<ApiError>);
  });

  it("reports invalid JSON request bodies before making a network request", async () => {
    const body: { self?: unknown } = {};
    body.self = body;

    await expect(
      requestJson({
        path: "/api/player/me",
        body,
        responseSchema: z.object({ id: z.string() }),
      }),
    ).rejects.toMatchObject({ kind: "invalid-request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces non-success HTTP responses as API errors", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Approval required" }), {
        status: 403,
      }),
    );

    await expect(
      requestJson({
        path: "/api/player/me",
        responseSchema: z.object({ id: z.string() }),
      }),
    ).rejects.toMatchObject({
      kind: "http",
      status: 403,
      message: "Approval required",
    });
  });
});
