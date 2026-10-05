/**
 * Shared retry/backoff utility used by every outbound call to a third-party API
 * (Gemini, Google Drive, Google OAuth, etc.) so the application gracefully survives
 * transient failures — most importantly HTTP 429 (rate limited) and 503 (overloaded) —
 * instead of crashing or bubbling a raw error straight up to the user.
 *
 * Strategy: exponential backoff with full jitter, capped at a configurable maximum delay,
 * honoring a server-provided `Retry-After` header/seconds when present instead of guessing.
 */

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 5. */
  maxRetries?: number;
  /** Base delay in ms used for the exponential backoff curve. Default: 1000ms. */
  baseDelayMs?: number;
  /** Upper bound for any single computed delay. Default: 30000ms. */
  maxDelayMs?: number;
  /** Decide whether a given error is worth retrying. Default: retries on HTTP 429 / 503. */
  isRetryable?: (error: any) => boolean;
  /** Optionally extract an explicit "retry after" delay (ms) from the error, e.g. Retry-After header. */
  getRetryAfterMs?: (error: any) => number | undefined;
  /** Called before each retry sleep, useful for logging. */
  onRetry?: (attempt: number, delayMs: number, error: any) => void;
  /** Label used in log output to identify which integration is retrying. */
  label?: string;
}

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;

function extractStatus(error: any): number | undefined {
  return error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.cause?.status;
}

export function isRateLimitOrOverloadedError(error: any): boolean {
  const status = extractStatus(error);
  if (status === 429 || status === 503) return true;
  // Some SDKs (e.g. @google/generative-ai) surface the status code inside the message text
  // rather than as a structured property, so fall back to a lightweight text match too.
  const message = String(error?.message || '');
  return /\b429\b|\b503\b|rate limit|too many requests|resource.?exhausted|quota/i.test(message);
}

/**
 * Distinguishes a hard quota exhaustion (e.g. "You exceeded your current quota" / daily free-tier
 * request limit) from a short-lived per-minute rate limit. Quota exhaustion for a given model
 * won't resolve itself within the retry window (it can require waiting minutes/hours, or until
 * the next day), so callers should avoid burning through retry attempts on it and instead fail
 * fast / fall back to a different model.
 */
export function isQuotaExceededError(error: any): boolean {
  const message = String(error?.message || '');
  return /exceeded your current quota|quota exceeded|requestsperday|generaterequestsperday|resource.?exhausted/i.test(message);
}

/** Full-jitter exponential backoff: random value between 0 and min(maxDelay, base * 2^(attempt-1)). */
function computeBackoffDelayMs(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  return Math.floor(Math.random() * exp) + 100;
}

/**
 * Extracts a Retry-After value (seconds or HTTP-date) from a Fetch API Headers object, if present.
 */
export function getRetryAfterMsFromHeaders(headers: Headers | undefined | null): number | undefined {
  if (!headers) return undefined;
  const retryAfter = headers.get('retry-after');
  if (!retryAfter) return undefined;
  const seconds = Number(retryAfter);
  if (!Number.isNaN(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(retryAfter);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}

/**
 * Runs `fn`, automatically retrying with exponential backoff + jitter when the error is
 * considered retryable (by default: HTTP 429 rate-limiting or 503 overload responses).
 * Rethrows the last error once retries are exhausted or the error is non-retryable.
 */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const isRetryable = options.isRetryable ?? isRateLimitOrOverloadedError;
  const label = options.label || 'request';

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err: any) {
      lastError = err;
      const retryable = isRetryable(err);
      if (!retryable || attempt === maxRetries) {
        throw err;
      }
      const retryAfterMs = options.getRetryAfterMs?.(err);
      const delayMs = retryAfterMs ?? computeBackoffDelayMs(attempt, baseDelayMs, maxDelayMs);
      const status = extractStatus(err);
      options.onRetry?.(attempt, delayMs, err);
      console.warn(
        `[retry] ${label} failed (attempt ${attempt}/${maxRetries}${status ? `, status ${status}` : ''}); ` +
        `retrying in ${delayMs}ms...`
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

/**
 * Drop-in replacement for the global `fetch` that automatically retries with exponential
 * backoff + jitter on HTTP 429 (rate limited) and 503 (service unavailable) responses,
 * honoring any `Retry-After` header the server provides. All other response statuses
 * (2xx, 4xx other than 429, 5xx other than 503) are returned as-is for the caller to
 * handle/parse normally — only transient rate-limit/overload responses trigger a retry.
 */
export async function fetchWithRetry(
  input: string | URL,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  return withRetry(
    async () => {
      const res = await fetch(input, init);
      if (res.status === 429 || res.status === 503) {
        const err: any = new Error(`Request to ${input} failed with status ${res.status}`);
        err.status = res.status;
        err.retryAfterMs = getRetryAfterMsFromHeaders(res.headers);
        throw err;
      }
      return res;
    },
    {
      label: options.label || String(input),
      getRetryAfterMs: err => err?.retryAfterMs,
      ...options
    }
  );
}
