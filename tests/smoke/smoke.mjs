// Headless smoke test: boot Electron under xvfb with a throwaway HOME, walk the
// local onboarding path against a generated 800-doc vault, screenshot each step.
//   xvfb-run -a node scripts/smoke.mjs
import { _electron as electron } from "playwright";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
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
    `---\ntitle: Doc ${i}\nproject: ${project}\ntags: [spec${i % 2 ? ", infra" : ""}]\ncreated: 2026-0${1 + (i % 9)}-0${1 + (i % 9)}T10:00:00Z\nsource: claude\n---\n\n# Doc ${i}\n\nBody of document ${i} about ${project}.\n`,
  );
}
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
await win.click("text=New");
let editor = null;
for (let i = 0; i < 40 && !editor; i++) {
  editor = app.windows().find((w) => /#editor/.test(w.url())) ?? null;
  if (!editor) await new Promise((r) => setTimeout(r, 250));
}
if (!editor) throw new Error("editor window never appeared");
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
await editor.click('button:has-text("Save & commit")');
await editor.waitForSelector("text=Saved", { timeout: 15000 });
await editor.waitForTimeout(400);
await editor.screenshot({ path: join(out, "smoke-6-editor-saved.png") });
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
await win.waitForTimeout(400);
await win.screenshot({ path: join(out, "smoke-7-main-after-save.png") });
console.log("errors:", errors.length ? errors : "none");
await app.close();
