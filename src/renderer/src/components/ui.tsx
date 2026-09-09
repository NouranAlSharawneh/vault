import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '@/lib/format'

/** The cherry mark: two stones on a splayed stem. `small` drops the stem. */
export function Logo({ size = 28, small = false, className }: { size?: number; small?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-label="Vault">
      {!small && (
        <path d="M13.5 16.5 C12 11 14 6.5 21 5 M18.5 16.5 C18.5 11 20 8 21 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      )}
      <circle cx="11" cy={small ? 16 : 21} r="5.5" fill="currentColor" />
      <circle cx="21" cy={small ? 16 : 21} r="5.5" fill="currentColor" />
    </svg>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 size={14} className={cx('spin', className)} />
}

export function Kbd({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <kbd className={dark ? 'dark' : undefined}>{children}</kbd>
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'outline' | 'default'
  loading?: boolean
}

export function Button({ variant = 'default', loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={cx('btn', variant === 'primary' && 'btn-primary', variant === 'ghost' && 'btn-ghost', variant === 'outline' && 'btn-outline', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Dot({ color, size = 8, className }: { color: string; size?: number; className?: string }) {
  return <span className={cx('inline-block rounded-full shrink-0', className)} style={{ width: size, height: size, background: color }} />
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-4', className)}>{children}</div>
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8 fade-in">
      <Logo size={36} className="text-line-2 mb-4" />
      <div className="text-[14px] font-medium text-ink-2">{title}</div>
      {hint && <div className="text-[12.5px] text-ink-3 mt-1 max-w-xs">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
