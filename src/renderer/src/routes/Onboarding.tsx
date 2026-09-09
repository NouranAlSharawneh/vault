import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Copy, ExternalLink, FolderOpen, Lock, Plus, RefreshCw, Search } from 'lucide-react'
import type { DeviceCodeSession, GitHubRepo } from '@shared/types'
import { api, on, errorMessage, alt, mod } from '@/lib/api'
import { useApp } from '@/stores/app'
import { Button, Kbd, Logo, Spinner } from '@/components/ui'
import { cx, plural } from '@/lib/format'

type Step = 'welcome' | 'signin' | 'repo' | 'scan' | 'done'

export function Onboarding() {
  const auth = useApp((s) => s.auth)
  const config = useApp((s) => s.config)
  const [step, setStep] = useState<Step>(() => (config ? 'done' : auth.status === 'signed-in' ? 'repo' : 'welcome'))

  useEffect(() => {
    if (step === 'signin' && auth.status === 'signed-in') setStep('repo')
  }, [auth.status, step])

  return (
    <div className="h-full flex flex-col bg-paper">
      <div className="drag h-10 shrink-0 flex items-center justify-end px-4">
        {auth.user && (
          <div className="no-drag flex items-center gap-1.5 text-[11.5px] text-ink-3">
            <span className="w-1.5 h-1.5 rounded-full bg-ok" /> Signed in as {auth.user.login}
          </div>
        )}
      </div>
      <div className="flex-1 flex items-start justify-center overflow-y-auto px-6 pb-10">
        <div className="w-full max-w-[520px] mt-8 fade-in" key={step}>
          {step === 'welcome' && <Welcome onNext={() => setStep(auth.status === 'signed-in' ? 'repo' : 'signin')} onLocal={() => setStep('repo')} />}
          {step === 'signin' && <SignIn onBack={() => setStep('welcome')} onLocal={() => setStep('repo')} />}
          {step === 'repo' && <RepoPicker onDone={() => setStep('scan')} />}
          {step === 'scan' && <FirstScan onDone={() => setStep('done')} />}
          {step === 'done' && <Done />}
        </div>
      </div>
    </div>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('rounded-[var(--radius-lg)] border border-line bg-paper shadow-pop', className)}>{children}</div>
}

// ---- 1. Welcome ---------------------------------------------------------------

function Welcome({ onNext, onLocal }: { onNext: () => void; onLocal: () => void }) {
  return (
    <div className="pt-10">
      <div className="w-12 h-12 rounded-[14px] bg-paper-2 border border-line flex items-center justify-center text-cherry mb-6">
        <Logo size={30} />
      </div>
      <h1 className="font-serif text-[34px] leading-[1.1] font-medium tracking-tight text-ink">Vault</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2 max-w-[420px]">
        Every markdown file you'd hate to lose, committed straight to a GitHub repo you own. No database, no account, no lock-in.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Button variant="primary" className="h-9 px-4 text-[13px]" onClick={onNext}>
          Connect GitHub <ArrowRight size={14} />
        </Button>
        <button className="text-[12.5px] text-ink-3 hover:text-ink underline underline-offset-4 decoration-line-2" onClick={onLocal}>
          Start local, connect later
        </button>
      </div>
      <div className="mt-14 grid grid-cols-3 gap-4 text-[12px] text-ink-3">
        <Feature k={`${alt} Space`} v="Capture the clipboard from any app." />
        <Feature k={`${mod} K`} v="Find anything you've saved." />
        <Feature k="git log" v="Every save is a commit. History is free." />
      </div>
    </div>
  )
}

function Feature({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="font-mono text-[11px] text-ink-2 mb-1">{k}</div>
      <div className="leading-snug">{v}</div>
    </div>
  )
}

// ---- 2. Sign in ---------------------------------------------------------------

function SignIn({ onBack, onLocal }: { onBack: () => void; onLocal: () => void }) {
  const [mode, setMode] = useState<'choose' | 'token' | 'device'>('choose')
  const [deviceAvailable, setDeviceAvailable] = useState(false)
  useEffect(() => {
    void api('auth:deviceAvailable').then(setDeviceAvailable)
  }, [])

  if (mode === 'token') return <TokenForm onBack={() => setMode('choose')} />
  if (mode === 'device') return <DeviceFlow onBack={() => setMode('choose')} />

  return (
    <Card className="p-7">
      <h2 className="font-serif text-[22px] font-medium text-ink">What GitHub will ask you to approve</h2>
      <p className="mt-1.5 text-[12.5px] text-ink-3 leading-relaxed">No password is ever typed into this app and no secret is shipped inside it. The token lives in your macOS Keychain.</p>
      <ul className="mt-5 space-y-2">
        <Scope ok title="Read and write one repository" desc="The vault repo you pick next. A fine-grained token can be narrowed to exactly that repo." />
        <Scope ok title="Push commits to its default branch" desc="Each saved document is one commit on main." />
        <Scope title="Never: your other repos, your org, your profile" desc="Nothing leaves your machine except commits to the vault repo." />
      </ul>
      <div className="mt-6 flex items-center justify-between">
        <button className="text-[12px] text-ink-4 hover:text-ink-2" onClick={onBack}>
          Back
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onLocal}>
            Skip for now
          </Button>
          {deviceAvailable && (
            <Button variant="outline" onClick={() => setMode('device')}>
              Continue to GitHub <ExternalLink size={12} />
            </Button>
          )}
          <Button variant="primary" onClick={() => setMode('token')}>
            Paste a token <ArrowRight size={13} />
          </Button>
        </div>
      </div>
    </Card>
  )
}

function Scope({ ok, title, desc }: { ok?: boolean; title: string; desc: string }) {
  return (
    <li className={cx('flex gap-3 rounded-[var(--radius-md)] px-3 py-2.5 border', ok ? 'bg-cherry-tint border-cherry-tint-2' : 'bg-paper-2 border-line')}>
      <span className={cx('mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0', ok ? 'bg-cherry text-white' : 'bg-line-2 text-paper')}>
        {ok ? <Check size={10} strokeWidth={3} /> : <Lock size={9} />}
      </span>
      <div>
        <div className="text-[12.5px] font-medium text-ink">{title}</div>
        <div className="text-[11.5px] text-ink-3 leading-snug mt-0.5">{desc}</div>
      </div>
    </li>
  )
}

function TokenForm({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])

  const submit = async () => {
    if (!token.trim()) return
    setBusy(true)
    setError(null)
    try {
      await api('auth:signInWithToken', token.trim())
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Card className="p-7">
      <h2 className="font-serif text-[22px] font-medium text-ink">Paste a fine-grained token</h2>
      <ol className="mt-3 text-[12.5px] text-ink-2 space-y-1.5 list-decimal pl-4 leading-relaxed">
        <li>
          Open{' '}
          <button className="text-cherry underline underline-offset-2" onClick={() => api('github:openInBrowser', 'settings/personal-access-tokens/new')}>
            github.com/settings/personal-access-tokens/new
          </button>
        </li>
        <li>
          Repository access: <b>Only select repositories</b> → your vault repo (create it first if you need to).
        </li>
        <li>
          Permissions: <b>Contents · Read and write</b>. Everything else stays “No access”.
        </li>
        <li>Generate, copy, paste it below. It is stored encrypted and never written to the repo.</li>
      </ol>
      <input
        ref={ref}
        type="password"
        className="input mt-5 font-mono text-[12px]"
        placeholder="github_pat_…"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void submit()}
        spellCheck={false}
      />
      {error && <div className="mt-2 text-[12px] text-cherry">{error}</div>}
      <div className="mt-5 flex items-center justify-between">
        <button className="text-[12px] text-ink-4 hover:text-ink-2" onClick={onBack}>
          Back
        </button>
        <Button variant="primary" loading={busy} disabled={!token.trim()} onClick={() => void submit()}>
          Sign in
        </Button>
      </div>
    </Card>
  )
}

function DeviceFlow({ onBack }: { onBack: () => void }) {
  const [session, setSession] = useState<DeviceCodeSession | null>(null)
  const [status, setStatus] = useState<'pending' | 'slow_down' | 'expired' | 'denied' | 'ok'>('pending')
  const [error, setError] = useState<string | null>(null)
  const [left, setLeft] = useState(0)
  const [copied, setCopied] = useState(false)

  const start = async () => {
    setError(null)
    setStatus('pending')
    try {
      const s = await api('auth:deviceStart')
      setSession(s)
      setLeft(s.expiresIn)
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  useEffect(() => {
    void start()
    const off = on('auth:deviceStatus', ({ status }) => setStatus(status))
    return () => {
      off()
      void api('auth:deviceCancel')
    }
  }, [])
  useEffect(() => {
    if (!session) return
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000)
    return () => clearInterval(t)
  }, [session])

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')

  return (
    <Card className="p-7 text-center">
      <h2 className="font-serif text-[22px] font-medium text-ink">Enter this code on GitHub</h2>
      <p className="mt-1 text-[12.5px] text-ink-3">
        Your browser should have opened <span className="font-mono">github.com/login/device</span>. Paste the code there and approve.
      </p>
      {session ? (
        <>
          <div className="mt-6 flex justify-center gap-1.5">
            {session.userCode.replace('-', '').split('').map((c, i) => (
              <span key={i} className={cx('w-9 h-11 rounded-[var(--radius-sm)] border border-line bg-paper-2 font-mono text-[20px] flex items-center justify-center text-ink', i === 4 && 'ml-3')}>
                {c}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-4 text-[11.5px]">
            <button
              className="text-cherry hover:underline flex items-center gap-1"
              onClick={() => {
                void navigator.clipboard.writeText(session.userCode)
                setCopied(true)
                setTimeout(() => setCopied(false), 1200)
              }}
            >
              <Copy size={11} /> {copied ? 'Copied' : 'Copy code'}
            </button>
            <button className="text-cherry hover:underline" onClick={() => api('github:openInBrowser', 'login/device')}>
              Reopen browser
            </button>
            <span className="font-mono text-ink-4">expires in {mm}:{ss}</span>
          </div>
          <div className="mt-6 flex items-center justify-between rounded-[var(--radius-md)] border border-line bg-paper-2 px-3 py-2 text-[12px] text-ink-2">
            <span className="flex items-center gap-2">
              {status === 'expired' || status === 'denied' ? null : <Spinner className="text-cherry" />}
              {status === 'pending' && 'Waiting for you to approve…'}
              {status === 'slow_down' && 'GitHub asked us to slow down — still waiting…'}
              {status === 'expired' && 'Code expired.'}
              {status === 'denied' && 'You cancelled on GitHub.'}
              {status === 'ok' && 'Approved!'}
            </span>
            {status === 'expired' || status === 'denied' ? (
              <button className="text-cherry hover:underline" onClick={() => void start()}>
                Try again
              </button>
            ) : (
              <button className="text-ink-4 hover:text-ink-2" onClick={onBack}>
                Cancel
              </button>
            )}
          </div>
        </>
      ) : error ? (
        <div className="mt-6 text-[12.5px] text-cherry">{error}</div>
      ) : (
        <div className="mt-8 flex justify-center">
          <Spinner className="text-ink-3" />
        </div>
      )}
    </Card>
  )
}

// ---- 3. Repo picker -------------------------------------------------------------

function RepoPicker({ onDone }: { onDone: () => void }) {
  const auth = useApp((s) => s.auth)
  const signedIn = auth.status === 'signed-in'
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null)
  const [filter, setFilter] = useState('')
  const [choice, setChoice] = useState<'new' | string>(signedIn ? 'new' : 'local')
  const [newName, setNewName] = useState('vault')
  const [localPath, setLocalPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void api('vault:defaultPath', 'vault').then(setLocalPath)
    if (signedIn) api('github:listRepos').then(setRepos).catch((e) => setError(errorMessage(e)))
  }, [signedIn])

  useEffect(() => {
    const name = choice === 'new' ? newName : choice === 'local' ? 'vault' : choice.split('/')[1]
    void api('vault:defaultPath', name || 'vault').then(setLocalPath)
  }, [choice, newName])

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return (repos ?? []).filter((r) => !f || r.fullName.toLowerCase().includes(f)).slice(0, 50)
  }, [repos, filter])

  const nameError = choice === 'new' && !/^[A-Za-z0-9._-]{1,100}$/.test(newName) ? 'Letters, numbers, dashes, dots and underscores only.' : null

  const go = async () => {
    setBusy(true)
    setError(null)
    try {
      let repo: GitHubRepo | null = null
      if (choice === 'new') repo = await api('github:createRepo', newName.trim(), true)
      else if (choice !== 'local') repo = repos!.find((r) => r.fullName === choice)!
      const cfg = await api('vault:setup', { repo, localPath })
      useApp.getState().setConfig(cfg)
      onDone()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Card className="p-7">
      <h2 className="font-serif text-[22px] font-medium text-ink">Where should the vault live?</h2>
      <p className="mt-1 text-[12.5px] text-ink-3">One repo holds everything. You can move it later — it's just files.</p>

      {signedIn ? (
        <>
          <Option selected={choice === 'new'} onClick={() => setChoice('new')} badge="recommended">
            <div className="flex items-center gap-2">
              <Plus size={13} className="text-ink-3" />
              <span className="font-medium">Create a new private repo</span>
            </div>
            {choice === 'new' && (
              <div className="mt-2 flex items-center gap-1 font-mono text-[12px]">
                <span className="text-ink-4">{auth.user?.login}/</span>
                <input className="input input-sm font-mono w-44" value={newName} onChange={(e) => setNewName(e.target.value)} onClick={(e) => e.stopPropagation()} />
              </div>
            )}
            {nameError && <div className="mt-1 text-[11px] text-cherry">{nameError}</div>}
          </Option>
          <div className="mt-5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-4">Or use one you have</div>
          <div className="mt-2 relative">
            <Search size={12} className="absolute left-2.5 top-2 text-ink-4" />
            <input className="input input-sm pl-7" placeholder="Filter your repos…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <div className="mt-2 max-h-48 overflow-y-auto rounded-[var(--radius-md)] border border-line divide-y divide-line">
            {repos === null && !error && (
              <div className="p-3 text-[12px] text-ink-4 flex items-center gap-2">
                <Spinner /> Loading repos…
              </div>
            )}
            {repos !== null && filtered.length === 0 && <div className="p-3 text-[12px] text-ink-4">No repos match.</div>}
            {filtered.map((r) => (
              <button
                key={r.fullName}
                onClick={() => setChoice(r.fullName)}
                className={cx('w-full text-left px-3 py-2 flex items-center gap-2.5 text-[12.5px] hover:bg-paper-2', choice === r.fullName && 'bg-cherry-tint')}
              >
                <span className={cx('w-3 h-3 rounded-full border', choice === r.fullName ? 'border-cherry bg-cherry ring-2 ring-inset ring-paper' : 'border-line-2')} />
                <span className="font-mono truncate">{r.fullName}</span>
                <span className="ml-auto text-[11px] text-ink-4 shrink-0">{r.private ? 'private' : 'public'}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-[var(--radius-md)] border border-line bg-paper-2 p-3 text-[12.5px] text-ink-2">
          Not signed in — the vault will be a local git repository. You can connect GitHub any time from Settings.
        </div>
      )}

      <div className="mt-5 flex items-center gap-2 text-[11.5px] text-ink-3">
        <FolderOpen size={12} />
        <span>clones to</span>
        <span className="font-mono text-ink-2 truncate">{localPath}</span>
        <button
          className="ml-auto text-cherry hover:underline shrink-0"
          onClick={async () => {
            const p = await api('vault:chooseFolder')
            if (p) setLocalPath(p)
          }}
        >
          Change
        </button>
      </div>
      {error && <div className="mt-3 text-[12px] text-cherry">{error}</div>}
      <div className="mt-5 flex justify-end">
        <Button variant="primary" loading={busy} disabled={!!nameError || !localPath} onClick={() => void go()}>
          Continue <ArrowRight size={13} />
        </Button>
      </div>
    </Card>
  )
}

function Option({ selected, onClick, badge, children }: { selected: boolean; onClick: () => void; badge?: string; children: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      className={cx('mt-4 rounded-[var(--radius-md)] border px-3.5 py-3 cursor-pointer transition-colors text-[13px]', selected ? 'border-cherry bg-cherry-tint' : 'border-line hover:bg-paper-2')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">{children}</div>
        {badge && <span className="chip chip-tag">{badge}</span>}
      </div>
    </div>
  )
}

// ---- 4. First scan ----------------------------------------------------------------

function FirstScan({ onDone }: { onDone: () => void }) {
  const progress = useApp((s) => s.progress)
  const index = useApp((s) => s.index)
  const refresh = useApp((s) => s.refreshIndex)
  useEffect(() => {
    void refresh()
  }, [refresh])
  const finished = !!index && (progress.phase === 'done' || progress.phase === 'idle' || (progress.phase === 'bodies' && index.docs.length === 0))
  useEffect(() => {
    if (finished) {
      const t = setTimeout(onDone, 700)
      return () => clearTimeout(t)
    }
  }, [finished, onDone])
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : finished ? 100 : 10
  return (
    <Card className="p-7">
      <h2 className="font-serif text-[22px] font-medium text-ink">Reading your vault</h2>
      <p className="mt-1 text-[12.5px] text-ink-3">Parsing frontmatter across every file. No index file is written into the repo.</p>
      <div className="mt-6 h-1.5 rounded-full bg-paper-3 overflow-hidden">
        <div className="h-full bg-cherry transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Stat n={index?.docs.length ?? 0} label="documents" />
        <Stat n={index?.projects.length ?? 0} label="projects" />
        <Stat n={index?.tags.length ?? 0} label="tags" />
      </div>
      {!!index?.orphans && <div className="mt-3 text-[11.5px] text-ink-3 text-center">{plural(index.orphans, 'file')} without frontmatter — listed under Inbox until you tag them.</div>}
    </Card>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-paper-2 py-3">
      <div className="font-serif text-[24px] leading-none text-ink">{n.toLocaleString()}</div>
      <div className="text-[11px] text-ink-3 mt-1">{label}</div>
    </div>
  )
}

// ---- 5. Done ------------------------------------------------------------------------

function Done() {
  const config = useApp((s) => s.config)
  const index = useApp((s) => s.index)
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto w-11 h-11 rounded-full bg-cherry-tint text-cherry flex items-center justify-center">
        <Check size={18} strokeWidth={2.5} />
      </div>
      <h2 className="mt-4 font-serif text-[24px] font-medium text-ink">Vault connected</h2>
      <p className="mt-1 text-[12.5px] text-ink-3">
        {plural(index?.docs.length ?? 0, 'document')} indexed.{' '}
        {config?.remote ? (
          <>
            Commits go straight to <span className="font-mono">{config.remote}</span> on <span className="font-mono">{config.branch}</span>.
          </>
        ) : (
          'Local-only for now — connect GitHub from Settings whenever you like.'
        )}
      </p>
      <div className="mt-6 rounded-[var(--radius-md)] bg-paper-2 border border-line p-4 text-left">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-4 text-center mb-3">Learn one thing</div>
        <div className="flex items-center gap-3 text-[12.5px] text-ink-2">
          <span className="w-[76px] shrink-0 text-right">
            <Kbd>{alt} Space</Kbd>
          </span>
          From anywhere — copy markdown, hit this, save it.
        </div>
        <div className="mt-2 flex items-center gap-3 text-[12.5px] text-ink-2">
          <span className="w-[76px] shrink-0 text-right">
            <Kbd>{mod} K</Kbd>
          </span>
          Find anything you've saved.
        </div>
      </div>
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="outline" onClick={() => (window.location.hash = 'main')}>
          Open the vault
        </Button>
        <Button variant="primary" onClick={() => api('window:openEditor')}>
          Save my first document
        </Button>
      </div>
      <button className="mt-4 text-[11.5px] text-ink-4 hover:text-ink-2 inline-flex items-center gap-1" onClick={() => api('vault:rescan')}>
        <RefreshCw size={10} /> Rescan
      </button>
    </Card>
  )
}
