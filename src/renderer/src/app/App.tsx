import { useEffect, useState } from 'react'
import type { AppRoute } from '@shared/types'

function routeFromHash(): AppRoute {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  return (['onboarding', 'main', 'editor', 'capture'].includes(h) ? h : 'main') as AppRoute
}

export function App() {
  const [route, setRoute] = useState<AppRoute>(routeFromHash)
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHash)
    const off = window.vault.on('navigate' as never, (r: unknown) => {
      window.location.hash = String(r)
    })
    return () => {
      window.removeEventListener('hashchange', onHash)
      off()
    }
  }, [])
  return (
    <div className="h-full flex items-center justify-center text-ink-3">
      <div className="text-center">
        <div className="text-2xl font-serif text-ink">Vault</div>
        <div className="mt-1 font-mono text-[11px]">route: {route}</div>
      </div>
    </div>
  )
}
