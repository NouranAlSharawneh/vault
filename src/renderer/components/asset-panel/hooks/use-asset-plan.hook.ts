import { useCallback, useEffect, useMemo, useState } from "react";
import { INBOX_SLUG } from "@shared/constants";
import { findAssetRefs, projectSlug } from "@shared/helpers";
import type { AssetRef } from "@shared/types";
import { ASSET_RESOLVE_DEBOUNCE_MS } from "@/constants";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
import type { AssetPlan, AssetPlanOptions } from "../asset-panel.types";

/**
 * Relative images in a body → where they are on disk → what to copy on save.
 * The base folder comes from the copied file, else the folder remembered for this
 * project, else the user picks one (and it is remembered).
 */
export function useAssetPlan({ body, project, sourceDir }: AssetPlanOptions): AssetPlan {
  const config = useApp((s) => s.config);
  const setConfig = useApp((s) => s.setConfig);
  const slug = projectSlug(project) || INBOX_SLUG;
  const remembered = config?.assetDirs?.[slug] ?? null;
  const [chosen, setChosen] = useState<string | null>(null);
  const [resolved, setResolved] = useState<{ key: string; refs: AssetRef[] }>({
    key: "",
    refs: [],
  });
  const [excluded, setExcluded] = useState<string[]>([]);

  const paths = useMemo(() => findAssetRefs(body), [body]);
  const baseDir = chosen ?? sourceDir ?? remembered;
  const key = `${baseDir ?? ""}\u0000${paths.join("\u0000")}`;

  useEffect(() => {
    if (!paths.length) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api("assets:resolve", baseDir, paths)
        .then((refs) => !cancelled && setResolved({ key, refs }))
        .catch(() => undefined);
    }, ASSET_RESOLVE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [baseDir, paths, key]);

  const refs = paths.length && resolved.key === key ? resolved.refs : [];

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
    excluded,
    found: refs.filter((r) => r.status === "found").length,
    missing: refs.filter((r) => r.status === "missing").length,
    bytes: included.reduce((n, r) => n + r.bytes, 0),
    chooseFolder,
    toggle,
    request: baseDir && included.length ? { baseDir, refs: included.map((r) => r.ref) } : undefined,
  };
}
