export type ApiErrorKind =
  | "configuration"
  | "network"
  | "timeout"
  | "http"
  | "invalid-request"
  | "invalid-response";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/**
 * Player-facing copy for an error. ApiError.message is diagnostic text for logs
 * and must not be rendered directly in the UI.
 */
export function getUserFacingErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC_MESSAGE;

  switch (error.kind) {
    case "network":
      return "You appear to be offline. Check your connection and try again.";
    case "timeout":
      return "This is taking longer than expected. Please try again.";
    case "http":
      if (error.code === "ROADMAP_VIDEO_BASELINE_REQUIRED") return "Your personal roadmap needs a verified video baseline. Video analysis is not available yet; provisional practice is still available.";
      if (error.code === "ROADMAP_CONTENT_UNAVAILABLE") return "Solo training drills are not available yet. Please try again later.";
      if (error.code === "ROADMAP_AI_UNAVAILABLE") return "We couldn't prepare your training path. Please try again in a few minutes.";
      if (error.code === "INVALID_ROADMAP_AI") return "We couldn't prepare a reliable training path. Please try again.";
      if (error.code === "ROADMAP_GENERATING") return "Your training path is already being prepared. Pull down to refresh in a moment.";
      if (error.code === "ROADMAP_VERSION_CONFLICT" || error.code === "ROADMAP_INPUT_CHANGED") return "Your goals or practice have changed. Pull down to refresh, then prepare your path again.";
      if (error.status === 401) return "Your session has ended. Please sign in again.";
      if (error.status === 403) return "Your account doesn't have access to this yet.";
      if (error.status === 404) return "We couldn't find what you were looking for.";
      if (error.status === 429) return "You've made too many requests. Please wait a moment and try again.";
      if (error.status !== undefined && error.status >= 500) {
        return "We're having trouble right now. Please try again shortly.";
      }
      return GENERIC_MESSAGE;
    case "configuration":
    case "invalid-request":
    case "invalid-response":
      return GENERIC_MESSAGE;
  }
}
