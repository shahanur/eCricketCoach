import { z } from "zod";

const webAppOriginSchema = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value));

/**
 * Player registration (plan selection, identity verification, checkout and
 * approval request) happens on the eCricketCoach web app. Returns null when the
 * web app origin is not configured so the UI can show an unavailable state.
 */
export function getWebAppOrigin(
  value = process.env.EXPO_PUBLIC_WEB_APP_URL,
): string | null {
  const result = webAppOriginSchema.safeParse(value?.trim());
  return result.success ? result.data.replace(/\/+$/, "") : null;
}
