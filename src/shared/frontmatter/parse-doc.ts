import { parse as parseYaml } from "yaml";
import { inferTitle } from "../helpers/infer-title";
import { toSource } from "../helpers/source";
import type { ConflictMark, Frontmatter } from "../types";
import type { ParsedDoc } from "./frontmatter.types";
import { splitFrontmatter } from "./split-frontmatter";

function asString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();

  return null;
}

function asTags(v: unknown): string[] {
  const clean = (t: string) => t.replace(/^#/, "").trim();
  if (Array.isArray(v)) {
    return v
      .map(asString)
      .filter((x): x is string => !!x)
      .map(clean)
      .filter(Boolean);
  }
  if (typeof v === "string")
    return v
      .split(/[,\s]+/)
      .map(clean)
      .filter(Boolean);

  return [];
}

const NONE = (body: string): ParsedDoc => ({ frontmatter: null, body, extra: {} });

/** Parse a whole document. Tolerant: any YAML mess yields `frontmatter: null`. */
export function parseDoc(raw: string): ParsedDoc {
  const { yaml, body } = splitFrontmatter(raw);
  if (yaml === null) return NONE(body);
  let data: unknown;
  try {
    data = parseYaml(yaml);
  } catch {
    return NONE(body);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return NONE(body);
  const d = data as Record<string, unknown>;
  const fm: Frontmatter = {
    title: asString(d.title) ?? inferTitle(body) ?? "Untitled",
    project: asString(d.project) ?? "",
    tags: asTags(d.tags),
    created: asString(d.created) ?? new Date(0).toISOString(),
    source: toSource(d.source),
  };
  if (d.starred === true) fm.starred = true;
  const conflict = asConflict(d.conflict);
  if (conflict) fm.conflict = conflict;
  const extra: Record<string, unknown> = {};
  for (const k of Object.keys(d))
    if (!(k in fm) && k !== "starred" && k !== "conflict") extra[k] = d[k];

  return { frontmatter: fm, body, extra };
}

/** The conflict stamp, or nothing — a half-written one is no better than none. */
function asConflict(v: unknown): ConflictMark | undefined {
  if (!v || typeof v !== "object") return undefined;
  const d = v as Record<string, unknown>;
  const of = asString(d.of);
  const at = asString(d.at);

  return of && at && d.from === "github" ? { of, from: "github", at } : undefined;
}
