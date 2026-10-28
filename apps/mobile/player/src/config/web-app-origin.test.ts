import { getWebAppOrigin } from "./web-app-origin";

describe("getWebAppOrigin", () => {
  it("normalizes a configured HTTP(S) web app origin", () => {
    expect(getWebAppOrigin(" https://app.example.test// ")).toBe(
      "https://app.example.test",
    );
  });

  it("returns null for missing or non-HTTP origins", () => {
    expect(getWebAppOrigin(undefined)).toBeNull();
    expect(getWebAppOrigin("")).toBeNull();
    expect(getWebAppOrigin("javascript:alert(1)")).toBeNull();
    expect(getWebAppOrigin("ftp://app.example.test")).toBeNull();
  });
});
