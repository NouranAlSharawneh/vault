import { useCallback, useEffect, useMemo, useState } from "react";
import { INBOX_SLUG } from "@shared/constants";
import { findAssetRefs, projectSlug } from "@shared/helpers";
import type { AssetResolution } from "@shared/types";
import { ASSET_RESOLVE_DEBOUNCE_MS } from "@/constants";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
import type { AssetPlan, AssetPlanOptions } from "../asset-panel.types";

/**
 * Relative images in a body, where they are on disk, and what to copy on save.
 * The base folder comes from the copied file, else the folder remembered for this project,
 * else main works it out from the refs themselves. Picking one by hand is the last resort,
 * not the first step, and a hand-picked folder is remembered for the project.
 */
export function useAssetPlan({ body, project, sourceDir }: AssetPlanOptions): AssetPlan {
  const config = useApp((s) => s.config);
  const setConfig = useApp((s) => s.setConfig);
  const slug = projectSlug(project) || INBOX_SLUG;
  const remembered = config?.assetDirs?.[slug] ?? null;
  const [chosen, setChosen] = useState<string | null>(null);
  const [resolved, setResolved] = useState<{ key: string } & AssetResolution>({
    key: "",
    baseDir: null,
    detected: false,
    refs: [],
  });
  const [excluded, setExcluded] = useState<string[]>([]);

  const paths = useMemo(() => findAssetRefs(body), [body]);
  /** What we ask about; what comes back may be a folder main worked out on its own. */
  const asked = chosen ?? sourceDir ?? remembered;
  const key = `${asked ?? ""} ${paths.join(" ")}`;

  useEffect(() => {
    if (!paths.length) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api("assets:resolve", asked, paths)
        .then((r) => !cancelled && setResolved({ key, ...r }))
        .catch(() => undefined);
    }, ASSET_RESOLVE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [asked, paths, key]);

  const settled = paths.length > 0 && resolved.key === key;
  const refs = settled ? resolved.refs : [];
  const baseDir = settled ? resolved.baseDir : asked;

  const chooseFolder = useCallback(async () => {
    const dir = await api("assets:chooseFolder", baseDir ?? undefined);
    if (!dir) return;
    setChosen(dir);
    const assetDirs = { ...(config?.assetDirs ?? {}), [slug]: dir };
    setConfig(await api("vault:updateConfig", { assetDirs }));
  }, [baseDir, config?.assetDirs, slug, setConfig]);

  const toggle = useCallback(
    (ref: string) =>
      setExcluded((x) => (x.includes(ref) ? x.filter((r) => r !== ref) : [...x, ref])),
    [],
  );

  const included = refs.filter((r) => r.status === "found" && !excluded.includes(r.ref));
  return {
    refs,
    baseDir,
    detected: settled && resolved.detected,
    excluded,
    found: refs.filter((r) => r.status === "found").length,
    missing: refs.filter((r) => r.status === "missing").length,
    /** Referenced but not going into the commit: never located, or deliberately skipped. */
    stranded: refs.filter((r) => r.status !== "found" || excluded.includes(r.ref)).length,
    bytes: included.reduce((n, r) => n + r.bytes, 0),
    chooseFolder,
    toggle,
    request: baseDir && included.length ? { baseDir, refs: included.map((r) => r.ref) } : undefined,
  };
}
