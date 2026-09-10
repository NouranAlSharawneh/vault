import type { LogoProps } from "./logo.types";

/** The cherry mark: two stones on a splayed stem. */
export function Logo({ size = 28, small = false, className }: LogoProps) {
  const cy = small ? 16 : 21;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-label="Vault">
      {!small && (
        <path
          d="M13.5 16.5 C12 11 14 6.5 21 5 M18.5 16.5 C18.5 11 20 8 21 5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      )}
      <circle cx="11" cy={cy} r="5.5" fill="currentColor" />
      <circle cx="21" cy={cy} r="5.5" fill="currentColor" />
    </svg>
  );
}
