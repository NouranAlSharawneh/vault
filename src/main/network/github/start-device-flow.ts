import { OAUTH_SCOPE } from "@shared/constants";
import { githubOAuth } from "../axios";
import type { DeviceFlowStart, RawDeviceCode } from "./github.types";

/**
 * Step 1 of OAuth device flow. Needs an OAuth App client ID (free to register at
 * github.com/settings/developers with "Device Flow" enabled).
 */
export async function startDeviceFlow(clientId: string): Promise<DeviceFlowStart> {
  const { data } = await githubOAuth().post<RawDeviceCode>("/login/device/code", {
    client_id: clientId,
    scope: OAUTH_SCOPE,
  });
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval,
  };
}
