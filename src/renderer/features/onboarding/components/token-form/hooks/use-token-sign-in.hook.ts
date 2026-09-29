import { useState } from "react";
import { errorMessage } from "@/helpers";
import { api } from "@/lib/api";

/** Owns the token field, submission state and error for the paste-a-token form. */
export function useTokenSignIn() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const value = token.trim();
    // Enter reaches here as well as the button, and the disabled button stopped only one.
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("auth:signInWithToken", value);
    } catch (e) {
      setError(tokenFailure(errorMessage(e)));
      setBusy(false);
    }
  };

  return { token, setToken, busy, error, submit, canSubmit: !!token.trim() };
}

/** GitHub's "Bad credentials", said as what to check. */
export function tokenFailure(message: string): string {
  if (/bad credentials|\b401\b/i.test(message))
    return "GitHub didn’t accept that token. Check it was copied in full and hasn’t expired.";

  return message;
}
