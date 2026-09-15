import type { EventChannel, InvokeChannel } from "./ipc.types";

/** Allow-list enforced by the preload so the renderer can only reach declared channels. */
export const INVOKE_CHANNELS = [
  "auth:state",
  "auth:signInWithToken",
  "auth:deviceStart",
  "auth:deviceCancel",
  "auth:methods",
  "auth:webStart",
  "auth:webCancel",
  "auth:signOut",
  "auth:tokenStatus",
  "github:listRepos",
  "github:createRepo",
  "github:openInBrowser",
  "vault:config",
  "vault:setup",
  "vault:chooseFolder",
  "vault:defaultPath",
  "vault:rescan",
  "vault:index",
  "vault:updateConfig",
  "vault:revealInFinder",
  "doc:read",
  "doc:save",
  "doc:trash",
  "trash:list",
  "trash:read",
  "trash:restore",
  "trash:purge",
  "doc:setStarred",
  "doc:history",
  "doc:restore",
  "doc:diff",
  "doc:pathPreview",
  "project:rename",
  "project:list",
  "sync:status",
  "sync:pushNow",
  "sync:pull",
  "conflicts:list",
  "conflicts:resolve",
  "views:list",
  "views:save",
  "views:delete",
  "templates:list",
  "search:query",
  "assets:resolve",
  "assets:chooseFolder",
  "capture:readClipboard",
  "capture:reveal",
  "capture:resize",
  "capture:hide",
  "capture:openEditor",
  "window:openMain",
  "window:revealDoc",
  "window:openEditor",
  "app:version",
  "app:platform",
  "app:openExternal",
  "app:reset",
] as const satisfies readonly InvokeChannel[];

export const EVENT_CHANNELS = [
  "index:changed",
  "index:progress",
  "sync:status",
  "auth:state",
  "auth:deviceStatus",
  "auth:webStatus",
  "capture:shown",
  "editor:open",
  "doc:reveal",
  "shortcut",
  "navigate",
] as const satisfies readonly EventChannel[];

/**
 * Compile-time guard: a channel declared in `ipc.types` but missing from the allow-lists
 * above fails at runtime with "Unknown channel", which only a smoke run would catch.
 * Here it is a type error instead — `AssertNever` rejects any left-over channel name.
 */
type AssertNever<T extends never> = T;
export type UnlistedInvoke = AssertNever<Exclude<InvokeChannel, (typeof INVOKE_CHANNELS)[number]>>;
export type UnlistedEvent = AssertNever<Exclude<EventChannel, (typeof EVENT_CHANNELS)[number]>>;
