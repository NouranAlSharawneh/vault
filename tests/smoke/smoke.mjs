// Headless smoke test: boot Electron under xvfb with a throwaway HOME, walk the
// local onboarding path against a generated 800-doc vault, screenshot each step.
//   xvfb-run -a node scripts/smoke.mjs
import { _electron as electron } from "playwright";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const home = mkdtempSync(join(tmpdir(), "vault-home-"));
const root = join(home, "Documents", "vault");
const PROJECTS = ["Atlas API", "Onboarding v2", "Research log"];
for (let i = 0; i < 800; i++) {
  const project = PROJECTS[i % 3];
  const slug = project.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  mkdirSync(join(root, slug), { recursive: true });
  writeFileSync(
    join(root, slug, `doc-${i}.md`),
    `# Doc ${i}\n\nBody of document ${i} about ${project}.\n\n---\n\n\`\`\`yaml\ntitle: Doc ${i}\nproject: ${project}\ntags: [spec${i % 2 ? ", infra" : ""}]\ncreated: 2026-0${1 + (i % 9)}-0${1 + (i % 9)}T10:00:00Z\nsource: claude\n\`\`\`\n`,
  );
}
// One doc embeds a repo-relative image, served back through vault://asset.
const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
mkdirSync(join(root, "research-log", "assets"), { recursive: true });
writeFileSync(join(root, "research-log", "assets", "hero.png"), Buffer.from(PNG_1x1, "base64"));
// Badges on one line must stay on one line (Tailwind's preflight makes img a block).
writeFileSync(
  join(root, "research-log", "badges.md"),
  "# Badges\n\n![a](assets/hero.png) ![b](assets/hero.png) ![c](assets/hero.png)\n\n---\n\n```yaml\ntitle: Badges\nproject: Research log\ntags: [spec]\ncreated: 2026-01-02T10:00:00Z\nsource: manual\n```\n",
);
writeFileSync(
  join(root, "research-log", "with-image.md"),
  "# With image\n\n![hero](assets/hero.png)\n\n---\n\n```yaml\ntitle: With image\nproject: Research log\ntags: [spec]\ncreated: 2026-01-01T10:00:00Z\nsource: manual\n```\n",
);
// A document that changed in two places. The pair is what a pull leaves behind — the
// copy carries the stamp pointing back at the original — so the review can be driven
// without standing up a remote.
const CONFLICT_DOC = "atlas-api/deploy-checklist.md";
const CONFLICT_COPY = "atlas-api/deploy-checklist-from-github.md";
const conflictDoc = (body, stamp) =>
  `# Deploy checklist\n\n${body}\n\n---\n\n\`\`\`yaml\ntitle: Deploy checklist\nproject: Atlas API\ntags: [spec]\ncreated: 2026-02-02T09:00:00Z\nsource: manual${stamp ? `\nconflict: { of: ${CONFLICT_DOC}, from: github, at: 2026-09-12T09:15:00Z }` : ""}\n\`\`\`\n`;
mkdirSync(join(root, "atlas-api"), { recursive: true });
writeFileSync(join(root, CONFLICT_DOC), conflictDoc("Drain the queue before the deploy.", false));
writeFileSync(join(root, CONFLICT_COPY), conflictDoc("Drain the queue AFTER the deploy.", true));

// A second pair, far longer than its card: two versions must be reviewable side by side
// without either one pushing the sheet off the screen.
const LONG_DOC = "atlas-api/runbook.md";
const LONG_COPY = "atlas-api/runbook-from-github.md";
const longBody = (who) =>
  Array.from({ length: 60 }, (_, i) =>
    i % 4 === 0 ? `${i + 1}. Step ${i + 1}, rewritten on ${who}.` : `${i + 1}. Step ${i + 1}.`,
  ).join("\n");
const longDoc = (who, stamp) =>
  `# Runbook\n\n${longBody(who)}\n\n---\n\n\`\`\`yaml\ntitle: Runbook\nproject: Atlas API\ntags: [spec]\ncreated: 2026-02-03T09:00:00Z\nsource: manual${stamp ? `\nconflict: { of: ${LONG_DOC}, from: github, at: 2026-09-13T11:20:00Z }` : ""}\n\`\`\`\n`;
writeFileSync(join(root, LONG_DOC), longDoc("this mac", false));
writeFileSync(join(root, LONG_COPY), longDoc("the other one", true));

const { execSync: sh } = await import("node:child_process");
sh(
  "git init -q -b main && git add -A && git -c user.name=smoke -c user.email=smoke@test commit -qm seed",
  { cwd: root },
);
const out = process.env.SMOKE_OUT ?? "/tmp";
const app = await electron.launch({
  args: ["."],
  env: {
    ...process.env,
    HOME: home,
    NODE_ENV: "production",
    ELECTRON_DISABLE_SANDBOX: "1",
    // Fake OAuth App so the sign-in screen shows every method (no network is hit).
    VAULT_GITHUB_CLIENT_ID: "smoke-client-id",
    VAULT_GITHUB_CLIENT_SECRET: "smoke-client-secret",
  },
});
await app.firstWindow();
let win = null;
for (let i = 0; i < 40 && !win; i++) {
  win = app.windows().find((w) => /#(onboarding|main)/.test(w.url())) ?? null;
  if (!win) await new Promise((r) => setTimeout(r, 250));
}
if (!win) throw new Error("main window never appeared");
const errors = [];
win.on("console", (m) => m.type() === "error" && errors.push(m.text()));
win.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
await win.waitForSelector("text=Connect GitHub", { timeout: 15000 });
await win.screenshot({ path: join(out, "smoke-1-welcome.png") });
await win.click("text=Connect GitHub");
await win.waitForSelector("text=What GitHub will ask you to approve");
await win.waitForTimeout(400);
await win.screenshot({ path: join(out, "smoke-1b-signin.png") });
await win.click("text=Continue with GitHub");
await win.waitForSelector("text=Approve Vault on GitHub");
await win.waitForTimeout(400);
await win.screenshot({ path: join(out, "smoke-1c-webflow.png") });
await win.click("text=Use another method");
await win.click("text=Skip for now");
await win.waitForSelector("text=Where should the vault live?");
await win.screenshot({ path: join(out, "smoke-2-repo.png") });
await win.click('button:has-text("Continue")');
await win.waitForSelector("text=Vault connected", { timeout: 30000 });
await win.waitForTimeout(500);
await win.screenshot({ path: join(out, "smoke-3-done.png") });
console.log("done screen:", (await win.innerText("body")).match(/[\d,]+ documents indexed/)?.[0]);
await win.click("text=Open the vault");
await win.waitForSelector("text=All documents");
await win.waitForTimeout(500);
await win.click("text=Doc 5 >> nth=0");
await win.waitForTimeout(500);
await win.screenshot({ path: join(out, "smoke-4-main.png") });
// ---- M2: create a document through the editor window and check the commit landed
const [editor] = await Promise.all([
  app.waitForEvent("window"),
  win.click('button:has-text("New")'),
]);
await editor.waitForLoadState("domcontentloaded");
editor.on("console", (m) => m.type() === "error" && errors.push("editor: " + m.text()));
editor.on("pageerror", (e) => errors.push("editor PAGEERROR: " + e.message));
await editor.waitForSelector(".cm-content");
await editor.click(".cm-content");
await editor.keyboard.type(
  "# Rate limiting at the edge\n\nWe currently rate-limit inside the application layer.\n\n```mermaid\nflowchart LR\n  A[Client] --> B[Edge POP]\n```\n",
);
await editor.fill('input[aria-label="project"]', "Atlas API");
await editor.keyboard.press("Escape");
await editor.fill('input[aria-label="tags"]', "spec");
await editor.keyboard.press("Enter");
await editor.waitForSelector("text=atlas-api/rate-limiting-at-the-edge.md");
await editor.waitForSelector(".mermaid-block svg", { timeout: 20000 });
await editor.waitForTimeout(300);
await editor.screenshot({ path: join(out, "smoke-5-editor.png") });
// Escape on a document with unsaved changes asks rather than throwing work away.
await editor.keyboard.press("Escape");
await editor.waitForSelector("text=Unsaved changes", { timeout: 5000 });
await editor.waitForTimeout(300);
await editor.screenshot({ path: join(out, "smoke-6-unsaved-prompt.png") });
await editor.click('button:has-text("Keep editing")');
await editor.waitForSelector("text=Unsaved changes", { state: "detached" });
await editor.click('button:has-text("Save & commit")');
await editor.waitForEvent("close", { timeout: 15000 });
// Saving from the editor hands the new doc to the main window, like the capture sheet.
await win.waitForSelector("text=atlas-api/rate-limiting-at-the-edge.md", { timeout: 10000 });
console.log("editor save revealed the doc in main");
await win.bringToFront();
// Wait for the window event rather than polling the list: a window that just closed can
// still be listed, and a page picked from it dies under the next keystroke.
const [blank] = await Promise.all([
  app.waitForEvent("window"),
  win.click('button:has-text("New")'),
]);
await blank.waitForLoadState("domcontentloaded");
await blank.waitForSelector(".cm-content");
// Escape closes the window, which can tear the page down while `press` is still in
// flight — so the press rejecting here means it worked. The close event is the result.
await Promise.all([
  blank.waitForEvent("close", { timeout: 5000 }),
  blank.keyboard.press("Escape").catch(() => undefined),
]);
if (app.windows().some((w) => /#editor/.test(w.url())))
  throw new Error("empty editor did not close on Escape");
console.log("empty editor closed on Escape");

const { execSync } = await import("node:child_process");
const log = execSync("git log --oneline -1", { cwd: root }).toString().trim();
console.log("last commit:", log);
if (!log.includes("add: Rate limiting at the edge")) throw new Error("commit not found: " + log);
const readme = (await import("node:fs")).readFileSync(join(root, "README.md"), "utf8");
if (!readme.includes("[Rate limiting at the edge](atlas-api/rate-limiting-at-the-edge.md)"))
  throw new Error("README not regenerated");
await win.bringToFront();
await win.waitForSelector("text=Rate limiting at the edge", { timeout: 10000 });
await win.click("text=Rate limiting at the edge >> nth=0");
await win.waitForTimeout(600);
await win.screenshot({ path: join(out, "smoke-7-main-after-save.png") });
// ---- M5: history drawer — commits, the diff of one, and restoring it
await win.click('button[aria-label="history"]');
await win.waitForSelector("text=add: Rate limiting at the edge", { timeout: 10000 });
await win.waitForSelector("text=/\\+\\d+/", { timeout: 10000 });
await win.waitForTimeout(400);
await win.screenshot({ path: join(out, "smoke-18-history.png") });
const firstDiff = await win.evaluate(() =>
  [...document.querySelectorAll('[data-testid="history-drawer"] .whitespace-pre-wrap')]
    .map((n) => n.textContent)
    .join("\n"),
);
if (!firstDiff.includes("Rate limiting at the edge"))
  throw new Error("history diff does not show the document's content:\n" + firstDiff.slice(0, 200));
// It has to be on screen, not merely in the DOM — the first version was nested inside
// the reader's card, which has overflow-hidden, so it rendered and was never visible.
const drawerBox = await win.evaluate(() => {
  const el = document.querySelector('[data-testid="history-drawer"]');
  const r = el?.getBoundingClientRect();
  return r ? { w: Math.round(r.width), right: Math.round(r.right), vw: window.innerWidth } : null;
});
if (!drawerBox || drawerBox.w < 300 || drawerBox.right > drawerBox.vw + 1)
  throw new Error("history drawer is not visible on screen: " + JSON.stringify(drawerBox));
console.log("history drawer shows the commit diff, visible:", JSON.stringify(drawerBox));
// Alignment. Text sits in a line box that reserves room for descenders, so a string
// without any — an all-caps label, a commit sha — floats above the middle of the band
// it is centred in and leans away from the icon beside it. These are the facts that
// keep the drawer straight; each one is something that has already gone wrong once.
const align = await win.evaluate(() => {
  const d = document.querySelector('[data-testid="history-drawer"]');
  const header = d.querySelector("header");
  const ul = d.querySelector("ul");
  const rows = [...ul.querySelectorAll("li > button")];
  const box = (el) => el.getBoundingClientRect();
  const mid = (el) => +(box(el).y + box(el).height / 2).toFixed(1);
  const tight = (el) => {
    const s = getComputedStyle(el);
    return Math.abs(parseFloat(s.lineHeight) - parseFloat(s.fontSize)) < 0.5;
  };
  return {
    headerPadTop: getComputedStyle(header).paddingTop,
    tight: [header.firstElementChild, d.querySelector("ul + div").firstElementChild].map(tight),
    headerMid: mid(header),
    labelMid: mid(header.firstElementChild),
    closeMid: mid(header.querySelector("button")),
    gapTop: +(box(rows[0]).top - box(ul).top).toFixed(1),
    gapBottom: +(box(ul).bottom - box(rows.at(-1)).bottom).toFixed(1),
    // Three columns the eye reads as one: text starts, text ends, chips end.
    left: [
      header.firstElementChild,
      rows[0].firstElementChild,
      d.querySelector("ul + div").firstElementChild,
    ].map((el) => Math.round(box(el).x)),
    right: [header.querySelector("svg"), rows[0].lastElementChild].map((el) =>
      Math.round(box(el).right),
    ),
    chips: [header.querySelector("button"), rows[0]].map((el) => Math.round(box(el).right)),
  };
});
if (align.headerPadTop !== "0px")
  throw new Error("drawer header is padded off its own centre: " + align.headerPadTop);
if (align.tight.some((t) => !t))
  throw new Error(
    "drawer text is not set leading-none, so it rides high: " + JSON.stringify(align.tight),
  );
for (const [name, v] of [
  ["label", align.labelMid],
  ["close button", align.closeMid],
])
  if (Math.abs(v - align.headerMid) > 0.5)
    throw new Error(`drawer ${name} is off the header's centre: ${v} vs ${align.headerMid}`);
if (align.gapTop !== align.gapBottom)
  throw new Error("commit list is not evenly inset: " + JSON.stringify(align));
for (const [name, col] of [
  ["left", align.left],
  ["right", align.right],
  ["chip", align.chips],
])
  if (new Set(col).size !== 1)
    throw new Error(`drawer ${name} edges do not share a column: ` + JSON.stringify(col));
console.log("drawer alignment:", JSON.stringify(align));
// Icon-only buttons say what they do on hover.
await win.hover('button[aria-label="history"]');
await win.waitForSelector('[role="tooltip"]', { timeout: 3000 });
const tipText = await win.textContent('[role="tooltip"]');
if (!tipText.startsWith("History")) throw new Error("history tooltip reads: " + tipText);
console.log("tooltip:", tipText);
// Close it before editing; the button is a toggle, so leaving it open would shut it later.
// Escape closes it, like every other overlay in the app.
await win.keyboard.press("Escape");
await win.waitForSelector('[data-testid="history-drawer"]', { state: "detached", timeout: 5000 });
await win.click('button[aria-label="history"]');
await win.waitForSelector('[data-testid="history-drawer"]');
await win.click('button[aria-label="close history"]');
// With the drawer shut the last button sits against the window edge, which is the case
// a centred label hangs off. It has to slide back in instead.
await win.hover('button[aria-label="move to trash"]');
await win.waitForSelector('[role="tooltip"]', { timeout: 3000 });
const tipEdge = await win.evaluate(() => {
  const b = document.querySelector('[role="tooltip"]').getBoundingClientRect();
  return { left: Math.round(b.x), right: Math.round(b.right), vw: window.innerWidth };
});
if (tipEdge.right > tipEdge.vw || tipEdge.left < 0)
  throw new Error("tooltip hangs off the window: " + JSON.stringify(tipEdge));
console.log("tooltip stays on screen:", JSON.stringify(tipEdge));

// ---- M5: two versions of one document, and a way to say which one wins
// The badge is the only way in, and it has to be read off the documents themselves —
// a restart with a pair still unanswered must still say so.
const REVIEW = 'button[aria-label^="review "]';
const badge = await win.textContent(REVIEW);
if (!/2 to review/.test(badge)) throw new Error("the badge does not ask for a review: " + badge);
await win.click(REVIEW);
await win.waitForSelector('[data-testid="conflict-sheet"]');
await win.waitForSelector("text=Deploy checklist");
await win.waitForTimeout(400);
await win.screenshot({ path: join(out, "smoke-21-conflicts.png") });
const review = await win.innerText('[data-testid="conflict-sheet"]');
for (const want of ["This Mac", "GitHub", "Keep both", "before the deploy", "AFTER the deploy"])
  if (!review.includes(want)) throw new Error(`conflict sheet is missing "${want}":\n` + review);
// Never "mine"/"theirs": every study of this says readers invert them.
if (/\bmine\b|\btheirs\b/i.test(review)) throw new Error("conflict sheet still says mine/theirs");

// Both pairs are offered at once — a list, not a queue you have to finish.
const pairsShown = await win.locator('[data-testid="conflict-sheet"] section').count();
if (pairsShown !== 2) throw new Error(`expected two documents to review, got ${pairsShown}`);

// A document longer than its card scrolls inside it, and neither the sheet nor the
// window grows to fit: a 60-step runbook must not push the buttons off the screen.
const longPair = await win.evaluate(() => {
  const sheet = document.querySelector('[data-testid="conflict-sheet"]');
  const panes = [...sheet.querySelectorAll("section")]
    .find((s) => s.textContent.includes("Runbook"))
    .querySelectorAll(".overflow-auto");
  const box = sheet.getBoundingClientRect();
  return {
    panes: [...panes].map((p) => ({
      scroll: p.scrollHeight,
      visible: p.clientHeight,
      scrollable: p.scrollHeight > p.clientHeight + 1,
    })),
    sheetBottom: Math.round(box.bottom),
    vh: window.innerHeight,
    bodyOverflows: document.body.scrollHeight > window.innerHeight,
  };
});
if (longPair.panes.length !== 2 || !longPair.panes.every((p) => p.scrollable))
  throw new Error("a long version does not scroll inside its card: " + JSON.stringify(longPair));
if (longPair.sheetBottom > longPair.vh || longPair.bodyOverflows)
  throw new Error("the review grew past the window: " + JSON.stringify(longPair));
const cardScroll = await win.evaluate(() => {
  const pane = [...document.querySelectorAll('[data-testid="conflict-sheet"] section')]
    .find((s) => s.textContent.includes("Runbook"))
    .querySelector(".overflow-auto");
  pane.scrollTop = 600;
  return pane.scrollTop;
});
if (cardScroll < 100) throw new Error("the card did not scroll: " + cardScroll);
// Scrolling one version carries the other with it — two long versions line up almost
// everywhere, so comparing them should not mean scrolling each in turn.
await win.waitForTimeout(200);
const together = await win.evaluate(() =>
  [
    ...[...document.querySelectorAll('[data-testid="conflict-sheet"] section')]
      .find((s) => s.textContent.includes("Runbook"))
      .querySelectorAll(".overflow-auto"),
  ].map((p) => p.scrollTop),
);
if (together[0] !== together[1])
  throw new Error("the two versions scrolled apart: " + JSON.stringify(together));
await win.waitForTimeout(300);
await win.screenshot({ path: join(out, "smoke-21b-conflicts-long.png") });
console.log("long versions scroll in place:", JSON.stringify(longPair.panes));

// Keep both on the long one: it stays, renamed so the two are told apart.
await win.click('[data-testid="conflict-sheet"] >> section:has-text("Runbook") >> text=Keep both');
await win.waitForFunction(
  () => document.querySelectorAll('[data-testid="conflict-sheet"] section').length === 1,
  { timeout: 10000 },
);
if (!readFileSync(join(root, LONG_COPY), "utf8").includes("Runbook (from GitHub)"))
  throw new Error("keeping both did not give the surviving copy a name of its own");

// Take the version from GitHub: it lands on the original path, and what was there goes
// to the trash rather than being deleted.
await win.click(
  '[data-testid="conflict-sheet"] >> section:has-text("Deploy checklist") >> text=GitHub >> xpath=../.. >> text=Use this one',
);
await win.waitForSelector('[data-testid="conflict-sheet"] >> text=Nothing to review', {
  timeout: 10000,
});
await win.waitForTimeout(600);
// With nothing left to show, the sheet keeps a floor rather than collapsing to a strip.
const settled = await win.evaluate(() =>
  Math.round(
    document.querySelector('[data-testid="conflict-sheet"]').getBoundingClientRect().height,
  ),
);
if (settled < 220) throw new Error("the empty review collapsed to " + settled + "px");
await win.screenshot({ path: join(out, "smoke-22-conflicts-done.png") });
const winner = readFileSync(join(root, CONFLICT_DOC), "utf8");
if (!winner.includes("AFTER the deploy")) throw new Error("the chosen version did not win");
if (winner.includes("conflict:")) throw new Error("the conflict stamp survived the choice");
if (existsSync(join(root, CONFLICT_COPY))) throw new Error("the copy was left behind");
if (!existsSync(join(root, ".trash", CONFLICT_DOC)))
  throw new Error("the version that lost was deleted instead of trashed");
await win.keyboard.press("Escape");
await win.waitForSelector('[data-testid="conflict-sheet"]', { state: "detached" });
if (await win.locator(REVIEW).count())
  throw new Error("the badge still asks for a review after the last pair was settled");
console.log("conflict review: resolved, loser in the trash, badge cleared");

// Edit the doc so there are two versions, then restore the older one.
const [ed2] = await Promise.all([
  app.waitForEvent("window"),
  win.click('button[aria-label="edit"]'),
]);
await ed2.waitForLoadState("domcontentloaded");
await ed2.waitForSelector(".cm-content");
await ed2.click(".cm-content");
await ed2.keyboard.press("Control+End");
await ed2.keyboard.type("\n\nA second revision.\n");
await ed2.click('button:has-text("Save & commit")');
await ed2.waitForEvent("close", { timeout: 15000 });
await win.bringToFront();
await win.waitForTimeout(800);
if (
  !readFileSync(join(root, "atlas-api", "rate-limiting-at-the-edge.md"), "utf8").includes(
    "A second revision.",
  )
)
  throw new Error("second revision was not saved");

await win.click('button[aria-label="history"]');
await win.waitForSelector("text=add: Rate limiting at the edge", { timeout: 10000 });
await win.click("text=add: Rate limiting at the edge");
await win.waitForSelector('button:has-text("Restore this version")', { timeout: 10000 });
await win.click('button:has-text("Restore this version")');
await win.waitForSelector("text=/Restored .* as a new commit/", { timeout: 15000 });
await win.waitForTimeout(800);
const afterRestore = readFileSync(join(root, "atlas-api", "rate-limiting-at-the-edge.md"), "utf8");
if (afterRestore.includes("A second revision."))
  throw new Error("restore did not bring the older version back");
const restoreLog = execSync("git log --oneline -3", { cwd: root }).toString();
console.log("after restore, top commits:", restoreLog.split("\n")[0]);
// The restore is itself a commit, so the list it came from must not still be stale.
await win.waitForSelector(
  '[data-testid="history-drawer"] >> text=update: Rate limiting at the edge',
  {
    timeout: 10000,
  },
);
console.log("history refreshed itself after the restore");
await win.click('button[aria-label="close history"]');

// ---- M3: ⌘K palette, sidebar rail, split view
await win.keyboard.press("Control+K");
await win.waitForSelector('input[aria-label="search"]');
await win.keyboard.type("rate limit");
await win.waitForSelector("text=Documents", { timeout: 5000 });
await win.waitForTimeout(300);
await win.screenshot({ path: join(out, "smoke-8-palette.png") });
await win.keyboard.press("Enter");
await win.waitForSelector("text=Rate limiting at the edge");
await win.click('button[aria-label="toggle sidebar"]');
await win.click("text=Split");
await win.waitForTimeout(400);
await win.screenshot({ path: join(out, "smoke-9-rail-split.png") });
await win.click('button[aria-label="toggle sidebar"]');
await win.waitForTimeout(300);
await win.screenshot({ path: join(out, "smoke-10-hidden.png") });
await win.click('button[aria-label="toggle sidebar"]');
// ---- images referenced from a doc load through vault://asset
await win.keyboard.press("Control+K");
await win.waitForSelector('input[aria-label="search"]');
await win.keyboard.type("with image");
await win.waitForSelector('[role="dialog"] >> text=With image', { timeout: 5000 });
await win.waitForTimeout(200);
await win.keyboard.press("Enter");
await win.waitForSelector('[role="dialog"]', { state: "detached" });
await win.click('button:has-text("Preview")');
const img = await win.waitForSelector(".prose-doc img", { timeout: 5000 });
await win.waitForFunction((el) => el.complete && el.naturalWidth > 0, img, { timeout: 5000 });
console.log("image src:", await img.getAttribute("src"));
await win.keyboard.press("Control+K");
await win.waitForSelector('input[aria-label="search"]');
await win.keyboard.type("badges");
await win.waitForSelector('[role="dialog"] >> text=Badges', { timeout: 5000 });
await win.waitForTimeout(200);
await win.keyboard.press("Enter");
await win.waitForSelector('[role="dialog"]', { state: "detached" });
await win.waitForSelector(".prose-doc img");
const rows = await win.evaluate(() =>
  [...document.querySelectorAll(".prose-doc img")].map((el) => el.getBoundingClientRect().top),
);
if (rows.length !== 3) throw new Error("expected 3 badges, got " + rows.length);
if (new Set(rows).size !== 1)
  throw new Error("badges wrapped onto separate lines: " + rows.join(", "));
console.log("badges inline on one row:", rows.length);
// Mermaid diagrams get zoom controls, like GitHub's.
await win.keyboard.press("Control+K");
await win.waitForSelector('input[aria-label="search"]');
await win.keyboard.type("rate limit");
await win.waitForSelector('[role="dialog"] >> text=Rate limiting', { timeout: 5000 });
await win.waitForTimeout(200);
await win.keyboard.press("Enter");
await win.waitForSelector('[role="dialog"]', { state: "detached" });
await win.waitForSelector(".mermaid-block svg", { timeout: 20000 });
const widthOf = () =>
  win.evaluate(() => document.querySelector(".mermaid-canvas svg").getBoundingClientRect().width);
const before = await widthOf();
await win.click('button[aria-label="zoom in"]');
await win.click('button[aria-label="zoom in"]');
await win.waitForSelector('button[aria-label="reset zoom"]:has-text("150%")', { timeout: 5000 });
await win.waitForTimeout(200);
const after = await widthOf();
// The label moving is not enough: the diagram itself has to grow.
if (!(after > before * 1.4)) throw new Error(`zoom did nothing: ${before} -> ${after}`);
console.log("mermaid diagram width:", Math.round(before), "->", Math.round(after));
// Zoomed past the pane, the diagram must be draggable — scrollbars alone are not enough.
for (let i = 0; i < 8; i++) await win.click('button[aria-label="zoom in"]');
const pane = await win.waitForSelector(".mermaid-block .cursor-grab", { timeout: 5000 });
const box = await pane.boundingBox();
await win.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await win.mouse.down();
await win.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2, { steps: 8 });
await win.mouse.up();
const scrolled = await win.evaluate(
  () => document.querySelector(".mermaid-block .overflow-auto").scrollLeft,
);
if (scrolled <= 0) throw new Error("drag did not pan the diagram, scrollLeft=" + scrolled);
console.log("mermaid pan scrollLeft:", Math.round(scrolled));
await win.waitForTimeout(300);
await win.screenshot({ path: join(out, "smoke-17-mermaid-zoom.png") });
await win.click('button[aria-label="reset zoom"]');
await win.waitForSelector('button[aria-label="reset zoom"]:has-text("100%")', { timeout: 5000 });
console.log("mermaid zoom: 150% then reset");
// ---- M4: the ⌃⌥V sheet, driven through main (xvfb has no global hotkey)
await app.evaluate(async ({ clipboard }) => {
  await clipboard.writeText(
    "# Edge POP inventory\n\nRegion, capacity and provider for each point of presence.\n\n- fra1\n- ams2\n",
  );
});
const capture = await app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes("#capture"));
  if (!w) return false;
  w.show();
  return true;
});
if (!capture) throw new Error("capture window missing");
const sheet = app.windows().find((w) => /#capture/.test(w.url()));
sheet.on("console", (m) => m.type() === "error" && errors.push("capture: " + m.text()));
await app.evaluate(async ({ BrowserWindow, clipboard }) => {
  const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes("#capture"));
  const text = await clipboard.readText();
  w.webContents.send("capture:shown", {
    text,
    words: 12,
    lines: 6,
    looksLikeMarkdown: true,
    detectedSource: "claude",
    detectedTitle: "Edge POP inventory",
  });
});
await sheet.waitForSelector("text=Capture from clipboard");
await sheet.waitForSelector("text=Edge POP inventory");
const hitsSelect = await sheet.evaluate(() => {
  const hint = [...document.querySelectorAll("span")].find((s) => s.textContent === "detected");
  const r = hint.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return el?.tagName === "SELECT" || el?.closest("select") !== null;
});
if (!hitsSelect) throw new Error("clicking the FROM hint does not reach the select");
console.log("FROM dropdown is clickable across the whole control");
const sheetFits = await sheet.evaluate(() => {
  const panel = document.querySelector(".dark.flex.flex-col");
  return { panel: Math.round(panel.getBoundingClientRect().height), win: window.innerHeight };
});
// The window used to be a fixed height, leaving dead space under the buttons.
if (sheetFits.win - sheetFits.panel > 40)
  throw new Error(`capture sheet leaves dead space: panel ${sheetFits.panel} in ${sheetFits.win}`);
console.log("capture sheet fits its content:", JSON.stringify(sheetFits));
await sheet.waitForTimeout(400);
await sheet.screenshot({ path: join(out, "smoke-11-capture.png") });
await sheet.keyboard.press("Control+Enter");
await sheet.waitForSelector("text=committed", { timeout: 15000 });
await sheet.screenshot({ path: join(out, "smoke-12-capture-saved.png") });
const log2 = execSync("git log --oneline -1", { cwd: root }).toString().trim();
console.log("capture commit:", log2);
// The sheet hands the new doc straight to the main window.
await win.waitForSelector("text=_inbox/edge-pop-inventory.md", { timeout: 10000 });
await win.waitForTimeout(300);
await win.screenshot({ path: join(out, "smoke-12b-capture-opened.png") });
if (!log2.includes("add: Edge POP inventory")) throw new Error("capture commit not found: " + log2);
// ---- M5: asset capture through the capture sheet (a source folder with the image)
const srcDir = join(home, "concorde");
mkdirSync(join(srcDir, "docs"), { recursive: true });
writeFileSync(
  join(srcDir, "docs", "hero-flyin.gif"),
  Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
);
await app.evaluate(async ({ clipboard }) => {
  await clipboard.writeText(
    "# Concorde\n\nA flight through history.\n\n![hero](docs/hero-flyin.gif)\n",
  );
});
await app.evaluate(
  async ({ BrowserWindow, clipboard }, sourcePath) => {
    const w = BrowserWindow.getAllWindows().find((x) =>
      x.webContents.getURL().includes("#capture"),
    );
    w.show();
    w.webContents.send("capture:shown", {
      text: await clipboard.readText(),
      words: 8,
      lines: 5,
      looksLikeMarkdown: true,
      detectedSource: "manual",
      detectedTitle: "Concorde",
      sourcePath,
    });
  },
  join(srcDir, "README.md"),
);
await sheet.waitForSelector('[data-testid="asset-panel"] >> text=1 image referenced');
await sheet.waitForSelector('[data-testid="asset-panel"] >> text=1 found');
await sheet.waitForTimeout(300);
await sheet.screenshot({ path: join(out, "smoke-13-capture-assets.png") });
await sheet.keyboard.press("Control+Enter");
await sheet.waitForSelector("text=committed _inbox/concorde.md", { timeout: 15000 });
const concorde = readFileSync(join(root, "_inbox", "concorde.md"), "utf8");
if (!concorde.includes("![hero](assets/hero-flyin.gif)"))
  throw new Error("asset link not rewritten:\n" + concorde);
if (!existsSync(join(root, "_inbox", "assets", "hero-flyin.gif")))
  throw new Error("asset not copied");
const assetCommit = execSync("git show --stat --format=%s HEAD", { cwd: root }).toString();
if (!assetCommit.includes("_inbox/assets/hero-flyin.gif"))
  throw new Error("asset not in commit:\n" + assetCommit);
console.log("asset commit:", assetCommit.split("\n")[0]);

// ---- M5: trash with undo, trash view, settings
await win.bringToFront();
await win.keyboard.press("Control+K");
await win.waitForSelector('input[aria-label="search"]');
await win.keyboard.type("concorde");
await win.waitForSelector('[role="dialog"] >> text=Concorde', { timeout: 5000 });
await win.waitForTimeout(200);
await win.keyboard.press("Enter");
await win.waitForSelector('[role="dialog"]', { state: "detached" });
await win.waitForSelector(".prose-doc img");
await win.click('button[aria-label="move to trash"]');
await win.waitForSelector("text=Moved “Concorde” to trash", { timeout: 10000 });
await win.waitForTimeout(300);
await win.screenshot({ path: join(out, "smoke-14-trashed.png") });
if (existsSync(join(root, "_inbox", "concorde.md")))
  throw new Error("doc still in place after trash");
await win.click('[role="status"] >> text=Undo');
await win.waitForSelector("text=Concorde >> nth=0", { timeout: 10000 });
await win.waitForTimeout(500);
if (!existsSync(join(root, "_inbox", "concorde.md")))
  throw new Error("undo did not restore the doc");
await win.keyboard.press("Control+Backspace");
await win.waitForSelector("text=Moved “Concorde” to trash", { timeout: 10000 });
await win.click('button[aria-label="dismiss"]');
// Trash has no sidebar row any more — it is reached from Settings.
await win.keyboard.press("Control+,");
await win.waitForSelector("text=Back to vault");
await win.click('button:has-text("View trash")');
await win.waitForSelector("text=Concorde >> nth=0", { timeout: 5000 });
await win.click("text=Concorde >> nth=0");
await win.waitForSelector('button:has-text("Restore")');
await win.waitForTimeout(300);
await win.screenshot({ path: join(out, "smoke-15-trash-view.png") });
await win.click('button:has-text("Delete forever")');
// The doc's image is referenced by nothing else, so the purge takes it too.
await win.waitForSelector("text=Deleted “Concorde” and 1 image forever", { timeout: 10000 });
await win.waitForTimeout(500);
if (existsSync(join(root, "_inbox", "assets", "hero-flyin.gif")))
  throw new Error("orphaned asset survived the purge");
const purge = execSync("git log --oneline -1", { cwd: root }).toString().trim();
if (!purge.includes("purge: Concorde")) throw new Error("purge commit not found: " + purge);
await win.keyboard.press("Control+,");
await win.waitForSelector("text=Back to vault");
await win.waitForSelector('button[aria-label="capture shortcut"]');
await win.click('button[aria-label="capture shortcut"]');
await win.keyboard.press("Control+Alt+J");
await win.waitForSelector("kbd:has-text('J')", { timeout: 5000 });
await win.waitForTimeout(400);
await win.screenshot({ path: join(out, "smoke-16-settings.png") });
const cfg = JSON.parse(readFileSync(join(home, ".config", "Vault", "config.json"), "utf8"));
if (cfg.vault.hotkey !== "Control+Alt+J") throw new Error("hotkey not saved: " + cfg.vault.hotkey);
await win.click("text=Back to vault");
await win.waitForSelector("text=All documents");
console.log("errors:", errors.length ? errors : "none");
await app.close();
