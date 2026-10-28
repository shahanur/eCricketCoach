import { openURL } from "expo-linking";
import { useCallback, useState } from "react";

import { getWebAppOrigin } from "../../config/web-app-origin";

export function useOpenWebApp() {
  const origin = getWebAppOrigin();
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async () => {
    if (!origin) return;
    setError(null);
    try {
      await openURL(origin);
    } catch {
      setError(
        `We couldn't open the website. Please visit ${origin} in your browser.`,
      );
    }
  }, [origin]);

  return { isAvailable: origin !== null, open, error };
}
