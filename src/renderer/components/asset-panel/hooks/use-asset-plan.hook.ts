import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ASSET_RESOLVE_DEBOUNCE_MS } from "@/constants";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
import { ASSET_MAX_BYTES, ASSET_WARN_BYTES, INBOX_SLUG } from "@shared/constants";
import { findAssetRefs, hashText, isPastedRef, projectSlug } from "@shared/helpers";
import type { AssetImport, AssetRef, AssetResolution } from "@shared/types";
import type { AssetPlan, AssetPlanOptions } from "../asset-panel.types";

/** How long a save waits for the images to be looked for before going on without them. */
const SETTLE_WAIT_MS = 3000;
/** Bodies whose folder and skipped images are remembered: the capture sheet's recent clips. */
const CHOICES_KEPT = 20;
const NO_OVERRIDES: Record<string, boolean> = {};

/** `record` with `key` set to `value`, newest last, the oldest dropped past the limit. */
function keep<T>(record: Record<string, T>, key: string, value: T): Record<string, T> {
  const rest = Object.entries(record).filter(([k]) => k !== key);

  return Object.fromEntries([...rest, [key, value]].slice(-CHOICES_KEPT));
}

/**
 * Relative images in a body, where they are on disk, and what to copy on save.
 * The base folder comes from the copied file, else the folder remembered for this project,
 * else main works it out from the refs themselves. Picking one by hand is the last resort,
 * not the first step, and a hand-picked folder is remembered for the project.
 *
 * Everything chosen here belongs to one body. The capture sheet is never unmounted, so a
 * folder picked, or an image skipped, for one clip used to carry over to the next; now
 * each clip keeps its own, and gets them back when it is shown again.
 */
export function useAssetPlan({ body, project, sourceDir, homeDir }: AssetPlanOptions): AssetPlan {
  const config = useApp((s) => s.config);
  const setConfig = useApp((s) => s.setConfig);
  const slug = projectSlug(project) || INBOX_SLUG;
  const remembered = config?.assetDirs?.[slug] ?? null;
  // Choices belong to a body, and are kept for each: a clip dismissed with Esc and shown
  // again gets back the folder picked and the images skipped for it.
  const bodyKey = useMemo(() => hashText(body), [body]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [toggled, setToggled] = useState<Record<string, Record<string, boolean>>>({});
  const [resolved, setResolved] = useState<{ key: string } & AssetResolution>({
    key: "",
    baseDir: null,
    detected: false,
    refs: [],
  });

  const paths = useMemo(() => findAssetRefs(body), [body]);
  const chosen = picked[bodyKey] ?? null;
  const overrides = toggled[bodyKey] ?? NO_OVERRIDES;
  /** What we ask about; what comes back may be a folder main worked out on its own. */
  const asked = chosen ?? sourceDir ?? remembered;
  const key = `${asked ?? ""} ${paths.join(" ")}`;

  useEffect(() => {
    if (!paths.length) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api("assets:resolve", asked, paths)
        .then((r) => !cancelled && setResolved({ key, ...r }))
        // A lookup that failed is settled too: nothing was found. Left unsettled, a save
        // waited on it and the panel never said anything.
        .catch(
          () =>
            !cancelled &&
            setResolved({ key, baseDir: asked, detected: false, refs: paths.map(missing) }),
        );
    }, ASSET_RESOLVE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [asked, paths, key]);

  const settled = paths.length > 0 && resolved.key === key;
  const pending = paths.length > 0 && !settled;
  const baseDir = settled ? resolved.baseDir : asked;
  const { refs, pasted } = sortRefs(settled ? resolved.refs : [], !!homeDir && baseDir === homeDir);

  const chooseFolder = useCallback(async () => {
    const dir = await api("assets:chooseFolder", baseDir ?? undefined);
    if (!dir) return;
    setPicked((p) => keep(p, bodyKey, dir));
    const assetDirs = { ...(config?.assetDirs ?? {}), [slug]: dir };
    setConfig(await api("vault:updateConfig", { assetDirs }));
  }, [baseDir, bodyKey, config?.assetDirs, slug, setConfig]);

  /** Copied unless skipped; a large file waits to be asked for; one over GitHub's limit never goes. */
  const included = useCallback(
    (r: AssetRef) =>
      r.status === "found" &&
      r.bytes <= ASSET_MAX_BYTES &&
      (overrides[r.ref] ?? r.bytes <= ASSET_WARN_BYTES),
    [overrides],
  );

  const toggle = useCallback(
    (ref: string) =>
      setToggled((t) => {
        const r = resolved.refs.find((x) => x.ref === ref);
        const now = r ? included(r) : false;

        return keep(t, bodyKey, { ...(t[bodyKey] ?? {}), [ref]: !now });
      }),
    [bodyKey, resolved.refs, included],
  );

  const going = refs.filter(included);
  const request = importRequest(baseDir, going, pasted);

  // A save pressed before the images have been looked for waits for the answer (briefly),
  // so it can't go ahead with links that are about to be found missing.
  const waiters = useRef<(() => void)[]>([]);
  useEffect(() => {
    if (pending) return;
    for (const done of waiters.current.splice(0)) done();
  }, [pending]);
  const whenSettled = useCallback(
    () =>
      pending
        ? new Promise<void>((done) => {
            waiters.current.push(done);
            setTimeout(done, SETTLE_WAIT_MS);
          })
        : Promise.resolve(),
    [pending],
  );

  return {
    refs,
    baseDir,
    detected: settled && resolved.detected,
    pending,
    lookingFor: pending ? paths.filter((p) => !isPastedRef(p)).length : 0,
    excluded: refs.filter((r) => r.status === "found" && !included(r)).map((r) => r.ref),
    found: refs.filter((r) => r.status === "found").length,
    missing: refs.filter((r) => r.status === "missing").length,
    /** Referenced but not going into the commit: never located, too large, or skipped. */
    stranded: refs.filter((r) => !included(r)).length,
    bytes: going.reduce((n, r) => n + r.bytes, 0),
    chooseFolder,
    toggle,
    whenSettled,
    request,
  };
}

function missing(ref: string): AssetRef {
  return { ref, name: ref.split("/").pop() ?? ref, status: "missing", bytes: 0 };
}

/**
 * The refs the panel lists and chooses among, and the pasted images that simply go.
 * Found in the document's own folder (`atHome`), an image is already in place: nothing
 * to say or copy. Images pasted into the editor are its own: always copied in, never
 * listed or offered a folder — they have one, in app data, until the save.
 */
function sortRefs(all: AssetRef[], atHome: boolean): { refs: AssetRef[]; pasted: string[] } {
  const pasted = all.filter((r) => isPastedRef(r.ref));

  return {
    refs: all.filter((r) => !isPastedRef(r.ref) && !(atHome && r.status === "found")),
    pasted: pasted
      .filter((r) => r.status === "found" && r.bytes <= ASSET_MAX_BYTES)
      .map((r) => r.ref),
  };
}

/** What the save copies in. Nothing but pasted images can be found without a folder, so
 *  a new document with only those still sends them. */
function importRequest(
  baseDir: string | null,
  going: AssetRef[],
  pasted: string[],
): AssetImport | undefined {
  const refs = [...(baseDir ? going.map((r) => r.ref) : []), ...pasted];

  return refs.length ? { baseDir: baseDir ?? "", refs } : undefined;
}
