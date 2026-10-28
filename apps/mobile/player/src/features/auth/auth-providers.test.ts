import { getSignInOptions } from "./auth-providers";

function mockProviders(body: Record<string, boolean>) {
  jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
}

describe("getSignInOptions", () => {
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

  it("enables native Google when the API can verify device tokens", async () => {
    mockProviders({ google: false, googleNative: true, microsoft: false, apple: false });

    await expect(getSignInOptions()).resolves.toEqual({
      nativeGoogle: true,
      websiteProviders: ["Google"],
    });
  });

  it("keeps browser-only providers on the website", async () => {
    mockProviders({ google: true, googleNative: false, microsoft: true, apple: false });

    await expect(getSignInOptions()).resolves.toEqual({
      nativeGoogle: false,
      websiteProviders: ["Google", "Microsoft"],
    });
  });

  it("reports no options when no providers are configured", async () => {
    mockProviders({ google: false, googleNative: false, microsoft: false, apple: false });

    await expect(getSignInOptions()).resolves.toEqual({
      nativeGoogle: false,
      websiteProviders: [],
    });
  });

  it("rejects malformed provider responses", async () => {
    mockProviders({ google: true });

    await expect(getSignInOptions()).rejects.toMatchObject({
      kind: "invalid-response",
    });
  });
});
