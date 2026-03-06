interface Props { label: string; color: string; active?: boolean; size?: 'sm' | 'md' }

export function Badge({ label, color, size = 'sm' }: Props) {
  return (
    <span style={{
      display: 'inline-block',
      padding: size === 'sm' ? '2px 8px' : '4px 12px',
      borderRadius: 99, fontSize: size === 'sm' ? 11 : 12, fontWeight: 600,
      background: color + '18', color, border: `1px solid ${color}30`, letterSpacing: .3,
    }}>{label}</span>
  )
}
