interface Props { size?: number }

export function AppLogo({ size = 28 }: Props) {
  const r = Math.round(size * 0.28)
  const icon = Math.round(size * 0.52)
  return (
    <div style={{
      width: size, height: size, borderRadius: r,
      background: '#6366f1', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    </div>
  )
}
