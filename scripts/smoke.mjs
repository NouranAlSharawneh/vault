// Headless smoke test: boot Electron under xvfb with a throwaway HOME, walk the
// local onboarding path against a generated 800-doc vault, screenshot each step.
//   xvfb-run -a node scripts/smoke.mjs
import { _electron as electron } from 'playwright'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const home = mkdtempSync(join(tmpdir(), 'vault-home-'))
const root = join(home, 'Documents', 'vault')
const PROJECTS = ['Atlas API', 'Onboarding v2', 'Research log']
for (let i = 0; i < 800; i++) {
  const project = PROJECTS[i % 3]
  const slug = project.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  mkdirSync(join(root, slug), { recursive: true })
  writeFileSync(
    join(root, slug, `doc-${i}.md`),
    `---\ntitle: Doc ${i}\nproject: ${project}\ntags: [spec${i % 2 ? ', infra' : ''}]\ncreated: 2026-0${1 + (i % 9)}-0${1 + (i % 9)}T10:00:00Z\nsource: claude\n---\n\n# Doc ${i}\n\nBody of document ${i} about ${project}.\n`,
  )
}
const out = process.env.SMOKE_OUT ?? '/tmp'
const app = await electron.launch({ args: ['.'], env: { ...process.env, HOME: home, NODE_ENV: 'production', ELECTRON_DISABLE_SANDBOX: '1' } })
await app.firstWindow()
let win = null
for (let i = 0; i < 40 && !win; i++) {
  win = app.windows().find((w) => /#(onboarding|main)/.test(w.url())) ?? null
  if (!win) await new Promise((r) => setTimeout(r, 250))
}
if (!win) throw new Error('main window never appeared')
const errors = []
win.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
win.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
await win.waitForSelector('text=Connect GitHub', { timeout: 15000 })
await win.screenshot({ path: join(out, 'smoke-1-welcome.png') })
await win.click('text=Start local, connect later')
await win.waitForSelector('text=Where should the vault live?')
await win.screenshot({ path: join(out, 'smoke-2-repo.png') })
await win.click('button:has-text("Continue")')
await win.waitForSelector('text=Vault connected', { timeout: 30000 })
await win.waitForTimeout(500)
await win.screenshot({ path: join(out, 'smoke-3-done.png') })
console.log('done screen:', (await win.innerText('body')).match(/[\d,]+ documents indexed/)?.[0])
await win.click('text=Open the vault')
await win.waitForSelector('text=All documents')
await win.waitForTimeout(500)
await win.click('text=Doc 5 >> nth=0')
await win.waitForTimeout(500)
await win.screenshot({ path: join(out, 'smoke-4-main.png') })
console.log('errors:', errors.length ? errors : 'none')
await app.close()
