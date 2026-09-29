// turndown-plugin-gfm ships no types. It exports turndown plugins: `gfm` is all of them.
declare module "turndown-plugin-gfm" {
  import type TurndownService from "turndown";

  type Plugin = (service: TurndownService) => void;

  export const gfm: Plugin;
  export const tables: Plugin;
  export const strikethrough: Plugin;
  export const taskListItems: Plugin;
}
