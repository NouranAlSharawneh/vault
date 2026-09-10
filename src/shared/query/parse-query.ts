import type { Source } from "../types";
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
      if (val) q.source.push(val.toLowerCase() as Source);
      break;
    case "is": {
      const v = val.toLowerCase();
      if (v === "starred") q.starred = true;
      else if (v === "unpushed") q.unpushed = true;
      else if (v === "orphan") q.orphan = true;
      break;
    }
    case "created": {
      const m = /^([<>]=?)?(.+)$/.exec(val);
      if (!m) break;
      const ts = parseDateish(m[2], now);
      if (ts === null) break;
      if ((m[1] ?? ">").startsWith(">")) q.createdAfter = ts;
      else q.createdBefore = ts;
      break;
    }
    default:
      // unknown operator → plain text
      q.text = `${q.text} ${key}:${val}`.trim();
  }
}
