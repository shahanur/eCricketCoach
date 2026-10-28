import { ApiError } from "./api-error";
import { getApiOrigin } from "./api-origin";

describe("getApiOrigin", () => {
  it("normalizes a configured HTTP API origin", () => {
    expect(getApiOrigin("https://api.example.test///")).toBe(
      "https://api.example.test",
    );
  });

  it("rejects missing and non-HTTP origins explicitly", () => {
    expect(() => getApiOrigin("")).toThrow(ApiError);
    expect(() => getApiOrigin("ftp://api.example.test")).toThrow(ApiError);
  });
});
