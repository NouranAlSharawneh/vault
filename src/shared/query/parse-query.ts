import { isSource } from "../helpers/source";
import { parseDateish } from "./parse-dateish";
import type { ParsedQuery } from "./query.types";

const TOKEN = /(\w+):(?:"([^"]*)"|(\S+))|"([^"]*)"|(\S+)/g;

export function parseQuery(input: string, now = Date.now()): ParsedQuery {
  const q: ParsedQuery = { text: "", project: [], tags: [], tagsEmpty: false, source: [] };
  const words: string[] = [];
  for (const m of input.matchAll(TOKEN)) {
    const [, key, quoted, bare, quotedWord, word] = m;
    if (key) applyOperator(q, key.toLowerCase(), (quoted ?? bare ?? "").trim(), now);
    else words.push(quotedWord ?? word ?? "");
  }
  q.text = [q.text, ...words].join(" ").trim();

  return q;
}

function applyOperator(q: ParsedQuery, key: string, val: string, now: number): void {
  switch (key) {
    case "project":
    case "p":
      if (val) q.project.push(val.toLowerCase());
      break;
    case "tag":
    case "tags":
    case "t":
      if (val.toLowerCase() === "empty") q.tagsEmpty = true;
      else if (val) q.tags.push(val.replace(/^#/, "").toLowerCase());
      break;
    case "source":
    case "from":
      addSource(q, val);
      break;
    case "is":
      applyIs(q, val.toLowerCase());
      break;
    case "created":
      applyCreated(q, val, now);
      break;
    default:
      // unknown operator → plain text
      q.text = `${q.text} ${key}:${val}`.trim();
  }
}

/** `from:banana` filters by nothing rather than quietly by `other`. */
function addSource(q: ParsedQuery, val: string): void {
  const source = val.toLowerCase();
  if (isSource(source)) q.source.push(source);
}

function applyIs(q: ParsedQuery, v: string): void {
  if (v === "starred") q.starred = true;
  else if (v === "unpushed") q.unpushed = true;
  else if (v === "orphan") q.orphan = true;
}

/**
 * `created:2026-03-14` is that day; `created:30d` is the last thirty days. With an
 * operator, `>` and `<` are strict about a calendar day, `>=` and `<=` take it in.
 */
function applyCreated(q: ParsedQuery, val: string, now: number): void {
  const m = /^([<>]=?)?(.+)$/.exec(val);
  if (!m) return;
  const span = parseDateish(m[2], now);
  if (!span) return;
  const op = m[1];
  if (!op) {
    q.createdAfter = span.start;
    if (!span.relative) q.createdBefore = span.end;
  } else if (op === ">") q.createdAfter = span.relative ? span.start : span.end + 1;
  else if (op === ">=") q.createdAfter = span.start;
  else if (op === "<") q.createdBefore = span.start - 1;
  else q.createdBefore = span.end;
}
