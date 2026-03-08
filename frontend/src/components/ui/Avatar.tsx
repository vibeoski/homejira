import type { Member } from '../../types'

interface Props { member: Member; size?: number }

export function Avatar({ member, size = 28 }: Props) {
  const letter = member.name?.charAt(0).toUpperCase() || '?'
  return (
    <span title={member.name} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%',
      background: member.color, color: 'white',
      fontSize: size * 0.42, fontWeight: 700, flexShrink: 0,
      fontFamily: 'system-ui, sans-serif', letterSpacing: 0,
    }}>
      {letter}
    </span>
  )
}
