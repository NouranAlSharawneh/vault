/**
 * Every place `query` appears in the text under `root`, ignoring case, as DOM ranges in
 * reading order. A match is looked for inside one text node, so a phrase split by
 * formatting ("rate **limit**") is not found as a whole — the words on either side are.
 */
export function findRanges(root: Node, query: string): Range[] {
  const q = query.toLowerCase();
  if (!q.trim()) return [];
  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const found: Range[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.nodeValue ?? "").toLowerCase();
    for (let i = text.indexOf(q); i >= 0; i = text.indexOf(q, i + q.length)) {
      const range = doc.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + q.length);
      found.push(range);
    }
  }

  return found;
}
