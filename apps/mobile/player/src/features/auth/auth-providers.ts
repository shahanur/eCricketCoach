import { z } from "zod";

import { requestJson } from "../../api/api-client";

const authProvidersSchema = z.object({
  google: z.boolean().optional(),
  googleNative: z.boolean().optional(),
  microsoft: z.boolean(),
  apple: z.boolean(),
});

export type AuthProvider = "Google" | "Microsoft" | "Apple";

export type SignInOptions = {
  /** The API can verify Google ID tokens obtained on the device. */
  nativeGoogle: boolean;
  /** Providers the player can use through the eCricketCoach website. */
  websiteProviders: AuthProvider[];
};

export async function getSignInOptions(
  signal?: AbortSignal,
): Promise<SignInOptions> {
  const response = await requestJson({
    path: "/api/auth/providers",
    responseSchema: authProvidersSchema,
    signal,
  });

  return {
    nativeGoogle: response.googleNative === true,
    websiteProviders: [
      ...(response.google || response.googleNative ? (["Google"] as const) : []),
      ...(response.microsoft ? (["Microsoft"] as const) : []),
      ...(response.apple ? (["Apple"] as const) : []),
    ],
  };
}
