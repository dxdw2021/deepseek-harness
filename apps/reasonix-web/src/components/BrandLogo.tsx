export function BrandLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 5 L25 10 V22 L16 27 L7 22 V10 Z" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="3.4" fill="var(--accent)" />
    </svg>
  )
}
