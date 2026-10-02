import { parse as parseYaml } from "yaml";
import { inferTitle } from "../helpers/infer-title";
import { toSource } from "../helpers/source";
import type { ConflictMark, Frontmatter } from "../types";
import type { ParsedDoc } from "./frontmatter.types";
import { frontmatterCandidates } from "./split-frontmatter";

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

/** Keys Marasca writes. A trailing block with none of them is someone's YAML example. */
const OWN_KEYS = ["title", "project", "tags", "created", "source", "starred", "conflict"];

/** The YAML as a mapping, or null when it doesn't parse to one. */
function readMapping(yaml: string | null): Record<string, unknown> | null {
  if (yaml === null) return null;
  try {
    const data: unknown = parseYaml(yaml);

    return data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Parse a whole document. Tolerant: when no block reads as metadata the document has
 * none, and its body is the whole file. Returning the text with a broken block cut out
 * instead meant the next save wrote the file back without it — that text was gone.
 */
export function parseDoc(raw: string): ParsedDoc {
  for (const candidate of frontmatterCandidates(raw)) {
    const data = readMapping(candidate.yaml);
    if (!data) continue;
    if (candidate.position === "bottom" && !OWN_KEYS.some((k) => k in data)) continue;

    return fromMapping(data, candidate.body);
  }

  return { frontmatter: null, body: raw, extra: {} };
}

function fromMapping(d: Record<string, unknown>, body: string): ParsedDoc {
  const fm: Frontmatter = {
    title: asString(d.title) ?? inferTitle(body) ?? "Untitled",
    project: asString(d.project) ?? "",
    tags: asTags(d.tags),
    // Empty when the file never said. The reader fills it from the file's birth time;
    // stamping 1970 here got written back into the file on the next save.
    created: asString(d.created) ?? "",
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
