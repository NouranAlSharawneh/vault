import type { InternalAxiosRequestConfig } from "axios";
import { GITHUB_API_VERSION, USER_AGENT } from "@shared/constants";
import type { TokenProvider } from "./axios.types";

/** Attaches the GitHub bearer token (when present) and the headers GitHub requires. */
export function createRequestInterceptor(getToken: TokenProvider) {
  return (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = getToken();
    if (token && !config.headers.has("Authorization")) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    config.headers.set("Accept", "application/vnd.github+json");
    config.headers.set("X-GitHub-Api-Version", GITHUB_API_VERSION);
    config.headers.set("User-Agent", USER_AGENT);

    return config;
  };
}
