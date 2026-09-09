import { useEffect, useState } from 'react'
import type { AppRoute } from '@shared/types'
import { subscribeToMain, useApp } from '@/stores/app'
import { Onboarding } from '@/routes/Onboarding'
import { Main } from '@/routes/Main'
import { Logo } from '@/components/ui'

function routeFromHash(): AppRoute {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  return (['onboarding', 'main', 'editor', 'capture'].includes(h) ? h : 'main') as AppRoute
}

export function App() {
  const [route, setRoute] = useState<AppRoute>(routeFromHash)
  const ready = useApp((s) => s.ready)
  const boot = useApp((s) => s.boot)

  useEffect(() => {
    subscribeToMain()
    void boot()
    const onHash = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHash)
    const off = window.vault.on('navigate' as never, (r: unknown) => {
      window.location.hash = String(r)
    })
    return () => {
      window.removeEventListener('hashchange', onHash)
      off()
    }
  }, [boot])

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center text-line-2">
        <Logo size={28} />
      </div>
    )
  }
  switch (route) {
    case 'onboarding':
      return <Onboarding />
    case 'editor':
      return <Placeholder name="Editor" />
    case 'capture':
      return <Placeholder name="Capture sheet" dark />
    default:
      return <Main />
  }
}

function Placeholder({ name, dark }: { name: string; dark?: boolean }) {
  return (
    <div className={dark ? 'h-full bg-overlay text-overlay-ink-2 flex items-center justify-center rounded-[var(--radius-lg)]' : 'h-full flex items-center justify-center text-ink-3'}>
      {name} — coming in the next milestone
    </div>
  )
}
