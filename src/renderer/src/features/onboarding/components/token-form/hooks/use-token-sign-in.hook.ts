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
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await api("auth:signInWithToken", value);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return { token, setToken, busy, error, submit, canSubmit: !!token.trim() };
}
