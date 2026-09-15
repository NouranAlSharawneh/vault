import { OAUTH_DEVICE_GRANT } from "@shared/constants";
import type { DevicePollStatus } from "@shared/types";
import type { StoredCredentials } from "../../store/token.store.types";
import { githubOAuth, NetworkError } from "../axios";
import type { RawDeviceToken } from "./github.types";
import { toCredentials } from "./token-grant";

const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

/**
 * Step 2: poll until GitHub returns a token or a terminal error. `onStatus` fires on
 * every tick so the UI can show "still waiting" vs "slow down".
 */
export async function pollDeviceFlow(
  clientId: string,
  deviceCode: string,
  intervalSec: number,
  signal: AbortSignal,
  onStatus: (s: DevicePollStatus) => void,
): Promise<StoredCredentials> {
  let interval = intervalSec;
  while (!signal.aborted) {
    await sleep(interval);
    if (signal.aborted) break;
    const { data } = await githubOAuth().post<RawDeviceToken>("/login/oauth/access_token", {
      client_id: clientId,
      device_code: deviceCode,
      grant_type: OAUTH_DEVICE_GRANT,
    });
    if (data.access_token) {
      onStatus("ok");

      return toCredentials(data);
    }
    switch (data.error) {
      case "authorization_pending":
        onStatus("pending");
        break;
      case "slow_down":
        interval = (data.interval ?? interval) + 5;
        onStatus("slow_down");
        break;
      case "expired_token":
        onStatus("expired");
        throw new NetworkError("The device code expired. Start again.", 410);
      case "access_denied":
        onStatus("denied");
        throw new NetworkError("You cancelled the authorisation on GitHub.", 403);
      default:
        throw new NetworkError(data.error ?? "Unknown device-flow error", 500);
    }
  }
  throw new NetworkError("Cancelled", 499);
}
