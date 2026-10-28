import { z } from "zod";

import { ApiError } from "./api-error";

const apiOriginSchema = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value));

export function getApiOrigin(value = process.env.EXPO_PUBLIC_API_URL): string {
  const result = apiOriginSchema.safeParse(value);

  if (!result.success) {
    throw new ApiError(
      "The API origin is missing or invalid. Set EXPO_PUBLIC_API_URL in the app environment.",
      "configuration",
    );
  }

  return result.data.replace(/\/+$/, "");
}
