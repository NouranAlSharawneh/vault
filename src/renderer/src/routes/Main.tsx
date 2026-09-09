import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { DocContent } from '@shared/types'
import { api } from '@/lib/api'
import { useApp } from '@/stores/app'
import { Button, Dot, Empty, Logo, SectionLabel } from '@/components/ui'
import { cx, plural, relativeTime } from '@/lib/format'
import { projectColor } from '@shared/slug'

/** M1 shell: project list · document list · raw reader. Replaced by the three-pane layout in M3. */
export function Main() {
  const index = useApp((s) => s.index)
  const config = useApp((s) => s.config)
  const [project, setProject] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [doc, setDoc] = useState<DocContent | null>(null)

  useEffect(() => {
    if (!selected) return setDoc(null)
    api('doc:read', selected).then(setDoc).catch(() => setDoc(null))
  }, [selected])

  if (!config) {
    return <Empty title="No vault connected" action={<Button variant="primary" onClick={() => (window.location.hash = 'onboarding')}>Set up Vault</Button>} />
  }
  const docs = (index?.docs ?? []).filter((d) => !project || d.projectSlug === project)

  return (
    <div className="h-full flex">
      <aside className="w-[230px] shrink-0 border-r border-line bg-paper-2 flex flex-col">
        <div className="drag h-12 shrink-0" />
        <div className="px-3 pb-3 flex-1 overflow-y-auto">
          <button className={cx('w-full text-left px-2 h-7 rounded-[var(--radius-sm)] text-[12.5px] flex items-center gap-2', !project ? 'bg-paper-3 font-medium' : 'hover:bg-paper-3')} onClick={() => setProject(null)}>
            <Logo size={14} small className="text-cherry" /> All documents <span className="ml-auto text-ink-4 text-[11px]">{index?.docs.length ?? 0}</span>
          </button>
          <SectionLabel className="mt-5 mb-1 px-2">Projects</SectionLabel>
          {index?.projects.map((p) => (
            <button key={p.slug} className={cx('w-full text-left px-2 h-7 rounded-[var(--radius-sm)] text-[12.5px] flex items-center gap-2', project === p.slug ? 'bg-paper-3 font-medium' : 'hover:bg-paper-3')} onClick={() => setProject(p.slug)}>
              <Dot color={p.slug === '_inbox' ? '#a9a49b' : projectColor(p.slug)} /> <span className="truncate">{p.name}</span>
              <span className="ml-auto text-ink-4 text-[11px]">{p.count}</span>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-line text-[11px] text-ink-4 flex items-center justify-between">
          <span className="font-mono truncate">{config.remote ?? 'local'}</span>
          <button className="icon-btn w-6 h-6" onClick={() => api('vault:rescan')} title="Rescan">
            <RefreshCw size={11} />
          </button>
        </div>
      </aside>
      <section className="w-[300px] shrink-0 border-r border-line flex flex-col">
        <div className="drag h-12 shrink-0 flex items-end px-4 pb-2 text-[11.5px] text-ink-3">{plural(docs.length, 'doc')}</div>
        <div className="flex-1 overflow-y-auto">
          {docs.map((d) => (
            <button key={d.path} onClick={() => setSelected(d.path)} className={cx('w-full text-left px-4 py-2.5 border-b border-line/70', selected === d.path ? 'bg-paper-2' : 'hover:bg-paper-2/60')}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-medium truncate">{d.title}</span>
                <span className="text-[10.5px] text-ink-4 shrink-0">{relativeTime(d.created)}</span>
              </div>
              <div className="text-[11.5px] text-ink-3 line-clamp-2 mt-0.5">{d.excerpt}</div>
            </button>
          ))}
        </div>
      </section>
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="drag h-12 shrink-0" />
        <div className="flex-1 overflow-y-auto px-12 pb-16">
          {doc ? (
            <article className="max-w-[680px] mx-auto">
              <h1 className="font-serif text-[30px] font-medium leading-tight">{doc.meta.title}</h1>
              <pre className="mt-6 whitespace-pre-wrap font-serif text-[16px] leading-relaxed select-text">{doc.body}</pre>
            </article>
          ) : (
            <Empty title="Select a document" hint="Rendered preview, ⌘K search and the editor arrive in the next milestones." />
          )}
        </div>
      </main>
    </div>
  )
}
