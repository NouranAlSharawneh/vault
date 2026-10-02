import { useCallback } from "react";
import { githubBlobPath } from "@/helpers";
import { api, fire } from "@/lib/api";
import { useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
import type { DocMeta } from "@shared/types";

interface Options {
  listed: DocMeta[];
  picked: string[];
  inTrash: boolean;
  select: (path: string | null) => void;
  pick: (paths: string[]) => void;
  bulk: {
    trash: (paths: string[]) => Promise<void>;
    star: (paths: string[], starred: boolean) => Promise<void>;
  };
}

/**
 * Right-click on a row. On a picked row the menu is about the whole selection; on any
 * other it selects that row first, as Finder does, so what the menu acts on is what the
 * reader shows. Main draws the menu and does what needs Finder or the clipboard; the rest
 * comes back here.
 */
export function useDocRowMenu({ listed, picked, inTrash, select, pick, bulk }: Options) {
  const show = useToast((s) => s.show);

  return useCallback(
    (path: string) => {
      const targets = picked.includes(path) ? picked : [path];
      if (targets.length === 1) {
        pick([]);
        select(path);
      }
      const byPath = new Map(listed.map((d) => [d.path, d]));
      const metas = targets.flatMap((p) => byPath.get(p) ?? []);
      const { config } = useApp.getState();
      const remote = config?.remote;
      const one = metas.length === 1 ? metas[0] : null;

      fire(
        api("menu:docRow", {
          path,
          count: targets.length,
          starred: metas.length > 0 && metas.every((m) => m.starred),
          github: !!remote && !!one && !one.unpushed,
          trashed: inTrash,
        }).then((action) => {
          switch (action) {
            case "open":
              return api("window:openEditor", path);
            case "star":
            case "unstar":
              return bulk.star(targets, action === "star");
            case "trash":
              return bulk.trash(targets);
            case "github":
              return remote
                ? api(
                    "github:openInBrowser",
                    githubBlobPath(remote, config?.branch ?? "main", path),
                  )
                : undefined;
            case "copyPath":
              show("Copied the path");

              return undefined;
            default:
              return undefined;
          }
        }),
        "Couldn’t do that",
      );
    },
    [listed, picked, inTrash, select, pick, bulk, show],
  );
}
