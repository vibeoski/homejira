import { CSSProperties } from 'react'

interface Props {
  label: string; color: string; active?: boolean
  onClick?: () => void; size?: 'sm' | 'md'; style?: CSSProperties
}

export function Chip({ label, color, active, onClick, size = 'sm', style }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: size === 'sm' ? '5px 12px' : '7px 16px',
        borderRadius: 99, border: `1.5px solid ${active ? color : 'var(--border)'}`,
        background: active ? color + '15' : onClick ? 'var(--bg-surface)' : 'transparent',
        color: active ? color : 'var(--text-secondary)', fontWeight: 600,
        fontSize: size === 'sm' ? 12 : 13,
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
        transition: 'all .15s', cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >{label}</button>
  )
}
