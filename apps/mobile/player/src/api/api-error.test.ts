import { ApiError, getUserFacingErrorMessage } from "./api-error";

describe("getUserFacingErrorMessage", () => {
  it("never exposes diagnostic messages", () => {
    const error = new ApiError(
      "The API origin is missing or invalid. Set EXPO_PUBLIC_API_URL.",
      "configuration",
    );
    const message = getUserFacingErrorMessage(error);
    expect(message).not.toMatch(/API|EXPO_PUBLIC|origin/);
    expect(message).toBe("Something went wrong. Please try again.");
  });

  it.each([
    [new ApiError("x", "network"), /offline/],
    [new ApiError("x", "timeout"), /longer than expected/],
    [new ApiError("x", "http", 401), /sign in again/],
    [new ApiError("x", "http", 403), /access/],
    [new ApiError("x", "http", 503), /trouble right now/],
    [new Error("boom"), /Something went wrong/],
  ])("maps %p to friendly copy", (error, expected) => {
    expect(getUserFacingErrorMessage(error)).toMatch(expected);
  });
});
