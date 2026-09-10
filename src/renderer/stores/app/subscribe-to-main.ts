import { on } from "@/lib/api";
import { useApp } from "./app.store";

let subscribed = false;

/** Wire main-process push events into the store. Safe to call more than once. */
export function subscribeToMain(): void {
  if (subscribed) return;
  subscribed = true;
  on("index:changed", (index) => useApp.setState({ index }));
  on("index:progress", (progress) => useApp.setState({ progress }));
  on("sync:status", (sync) => useApp.setState({ sync }));
  on("auth:state", (auth) => useApp.setState({ auth }));
}
