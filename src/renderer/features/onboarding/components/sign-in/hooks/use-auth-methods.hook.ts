import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AuthMethods } from "@shared/types";

const NONE: AuthMethods = { device: false };

/**
 * Which sign-in routes main has credentials for (PAT paste is always available). `null`
 * until main answers, so the screen doesn't offer "Paste a token" and then swap it out.
 */
export function useAuthMethods(): AuthMethods | null {
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  useEffect(() => {
    api("auth:methods")
      .then(setMethods)
      .catch(() => setMethods(NONE));
  }, []);

  return methods;
}
