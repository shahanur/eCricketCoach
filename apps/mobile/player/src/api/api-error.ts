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
  ) {
    super(message);
    this.name = "ApiError";
  }
}
