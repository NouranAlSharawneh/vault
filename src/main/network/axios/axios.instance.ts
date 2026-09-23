import axios, { type AxiosInstance } from "axios";
import { GITHUB_API, GITHUB_WEB, NETWORK_TIMEOUT_MS } from "@shared/constants";
import type { NetworkOptions } from "./axios.types";
import { createRequestInterceptor } from "./request.interceptor";
import { createResponseInterceptor } from "./response.interceptor";

let api: AxiosInstance | null = null;
let oauth: AxiosInstance | null = null;

/** Wire the shared instances once at startup. */
export function configureNetwork(opts: NetworkOptions): void {
  api = axios.create({ baseURL: opts.baseUrls?.api ?? GITHUB_API, timeout: NETWORK_TIMEOUT_MS });
  api.interceptors.request.use(createRequestInterceptor(opts.getToken));
  const res = createResponseInterceptor(opts.onAuthExpired);
  api.interceptors.response.use(res.onFulfilled, res.onRejected);

  // OAuth endpoints live on github.com, take no bearer token, and return JSON on request.
  oauth = axios.create({
    baseURL: opts.baseUrls?.oauth ?? GITHUB_WEB,
    timeout: NETWORK_TIMEOUT_MS,
    headers: { Accept: "application/json" },
  });
  const oauthRes = createResponseInterceptor();
  oauth.interceptors.response.use(oauthRes.onFulfilled, oauthRes.onRejected);
}

/** REST client for api.github.com. */
export function githubApi(): AxiosInstance {
  if (!api) throw new Error("configureNetwork() must run before any request");

  return api;
}

/** Client for the github.com OAuth device-flow endpoints. */
export function githubOAuth(): AxiosInstance {
  if (!oauth) throw new Error("configureNetwork() must run before any request");

  return oauth;
}
