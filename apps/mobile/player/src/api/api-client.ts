import { z } from "zod";

import { ApiError } from "./api-error";
import { getApiOrigin } from "./api-origin";

type JsonRequestOptions<T> = {
  path: string;
  responseSchema: z.ZodType<T>;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

function getErrorMessage(body: string, status: number): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null) {
      const errorRecord = parsed as Record<string, unknown>;
      const message =
        typeof errorRecord.message === "string"
          ? errorRecord.message
          : typeof errorRecord.error === "string"
            ? errorRecord.error
            : null;

      if (message) {
        return message;
      }
    }
  } catch {
    // Non-JSON error bodies are reported with the HTTP status only.
  }

  return `The server returned HTTP ${status}.`;
}

export async function requestJson<T>({
  path,
  responseSchema,
  method = "GET",
  body,
  accessToken,
  signal,
  timeoutMs = 15_000,
}: JsonRequestOptions<T>): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ApiError(
      "API paths must be relative to the configured origin.",
      "configuration",
    );
  }

  let serializedBody: string | undefined;
  if (body !== undefined) {
    try {
      serializedBody = JSON.stringify(body);
    } catch {
      throw new ApiError(
        "The request body could not be encoded as JSON.",
        "invalid-request",
      );
    }
    if (serializedBody === undefined) {
      throw new ApiError(
        "The request body could not be encoded as JSON.",
        "invalid-request",
      );
    }
  }

  const origin = getApiOrigin();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  try {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(serializedBody === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: serializedBody,
      signal: controller.signal,
    });
    const responseBody = await response.text();

    if (!response.ok) {
      throw new ApiError(
        getErrorMessage(responseBody, response.status),
        "http",
        response.status,
      );
    }

    let responseData: unknown;
    try {
      responseData = JSON.parse(responseBody);
    } catch {
      throw new ApiError(
        "The server returned an invalid JSON response.",
        "invalid-response",
        response.status,
      );
    }

    const parsedResponse = responseSchema.safeParse(responseData);
    if (!parsedResponse.success) {
      throw new ApiError(
        "The server response did not match the expected format.",
        "invalid-response",
        response.status,
      );
    }

    return parsedResponse.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new ApiError("The request timed out or was cancelled.", "timeout");
    }
    if (error instanceof TypeError) {
      throw new ApiError(
        "Could not reach the server. Check your connection and try again.",
        "network",
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
