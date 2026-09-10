import { useEffect, useState } from "react";
import type { AuthMethods } from "@shared/types";
import { api } from "@/lib/api";

const NONE: AuthMethods = { oauth: false, device: false };

/** Which sign-in routes main has credentials for (PAT paste is always available). */
export function useAuthMethods(): AuthMethods {
  const [methods, setMethods] = useState<AuthMethods>(NONE);
  useEffect(() => {
    api("auth:methods")
      .then(setMethods)
      .catch(() => setMethods(NONE));
  }, []);
  return methods;
}
