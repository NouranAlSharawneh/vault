import type { DeviceCodeSession } from "@shared/types";

/** Raw GitHub REST shapes — mapped to `@shared/types` before leaving this folder. */
export interface RawGitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface RawGitHubRepo {
  full_name: string;
  name: string;
  private: boolean;
  default_branch: string;
  clone_url: string;
  pushed_at: string;
  description: string | null;
  owner: { login: string };
  permissions?: { push?: boolean };
}

export interface RawDeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface RawDeviceToken {
  access_token?: string;
  error?: string;
  interval?: number;
}

export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  state: string;
}

export interface ExchangeParams {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}

export type DeviceFlowStart = DeviceCodeSession & { deviceCode: string };
