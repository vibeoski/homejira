import type { Member } from '../../types'

interface Props { member: Member; size?: number }

export function Avatar({ member, size = 28 }: Props) {
  return (
    <span
      title={member.name}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: '50%', fontSize: size * 0.55,
        background: member.color + '22', border: `2px solid ${member.color}`, flexShrink: 0,
      }}
    >
      {member.avatar}
    </span>
  )
}
