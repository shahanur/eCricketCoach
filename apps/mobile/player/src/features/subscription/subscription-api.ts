import { z } from "zod";

import { ApiError } from "../../api/api-error";
import { requestJson } from "../../api/api-client";
import { secureSessionStorage } from "../../session/secure-session-storage";

export const subscriptionSchema = z.object({
  status: z.enum(["ACTIVE", "EXPIRED", "INACTIVE", "UNAVAILABLE"]),
  source: z.enum(["DEVELOPMENT_APPROVAL", "NONE"]),
  paymentVerified: z.literal(false),
  plan: z.object({
    id: z.literal("INDIVIDUAL"),
    name: z.string().min(1),
    currency: z.literal("GBP"),
    priceMonthlyMinor: z.number().int().nonnegative(),
    billingCycle: z.literal("MONTHLY"),
    profileLimit: z.literal(1),
    monthlyAnalysisLimit: z.literal(5),
  }),
  period: z.object({
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
  }).nullable(),
  autoRenews: z.literal(false),
  capabilities: z.object({
    purchase: z.literal(false),
    restorePurchases: z.literal(false),
    analysis: z.literal(false),
  }),
}).superRefine((value, context) => {
  const hasPeriod = value.period !== null;
  if ((value.status === "ACTIVE" || value.status === "EXPIRED") !== hasPeriod ||
      (value.source === "DEVELOPMENT_APPROVAL") !== hasPeriod ||
      (value.period && Date.parse(value.period.endsAt) <= Date.parse(value.period.startsAt))) {
    context.addIssue({ code: "custom", message: "Invalid subscription period." });
  }
});

export type PlayerSubscription = z.infer<typeof subscriptionSchema>;

export async function getPlayerSubscription(signal?: AbortSignal): Promise<PlayerSubscription> {
  const accessToken = await secureSessionStorage.getAccessToken();
  if (!accessToken) throw new ApiError("Access token required.", "http", 401);
  return requestJson({
    path: "/api/player/subscription",
    responseSchema: subscriptionSchema,
    accessToken,
    signal,
  });
}
