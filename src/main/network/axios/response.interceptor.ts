import { isAxiosError, type AxiosError, type AxiosResponse } from "axios";
import { NetworkError } from "./network-error";

export type AuthExpiredHandler = () => void;

/** Unwraps successful responses; converts every failure into a `NetworkError`. */
export function createResponseInterceptor(onAuthExpired?: AuthExpiredHandler) {
  const onFulfilled = (response: AxiosResponse): AxiosResponse => response;

  const onRejected = (error: unknown): never => {
    if (isAxiosError(error)) {
      const e = error as AxiosError<{ message?: string }>;
      const status = e.response?.status ?? 0;
      const message =
        e.response?.data?.message ??
        (status ? e.response?.statusText : "Network unreachable") ??
        e.message;
      if (status === 401) onAuthExpired?.();
      throw new NetworkError(message || "Request failed", status, e.code);
    }
    throw error instanceof NetworkError ? error : new NetworkError(String(error), 0);
  };

  return { onFulfilled, onRejected };
}
