import { useState } from 'react'
import { authApi } from '../../api/auth'

interface Props {
  onRegistered: (phone: string) => void
  onUnregistered: (phone: string) => void
}

interface CountryCode {
  code: string
  flag: string
  name: string
  tz: string[]
}

const COUNTRIES: CountryCode[] = [
  { code: '+1',   flag: '🇺🇸', name: 'US',  tz: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu'] },
  { code: '+1',   flag: '🇨🇦', name: 'CA',  tz: ['America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Halifax'] },
  { code: '+44',  flag: '🇬🇧', name: 'GB',  tz: ['Europe/London'] },
  { code: '+91',  flag: '🇮🇳', name: 'IN',  tz: ['Asia/Kolkata', 'Asia/Calcutta'] },
  { code: '+86',  flag: '🇨🇳', name: 'CN',  tz: ['Asia/Shanghai', 'Asia/Beijing'] },
  { code: '+81',  flag: '🇯🇵', name: 'JP',  tz: ['Asia/Tokyo'] },
  { code: '+82',  flag: '🇰🇷', name: 'KR',  tz: ['Asia/Seoul'] },
  { code: '+49',  flag: '🇩🇪', name: 'DE',  tz: ['Europe/Berlin'] },
  { code: '+33',  flag: '🇫🇷', name: 'FR',  tz: ['Europe/Paris'] },
  { code: '+39',  flag: '🇮🇹', name: 'IT',  tz: ['Europe/Rome'] },
  { code: '+34',  flag: '🇪🇸', name: 'ES',  tz: ['Europe/Madrid'] },
  { code: '+55',  flag: '🇧🇷', name: 'BR',  tz: ['America/Sao_Paulo', 'America/Manaus'] },
  { code: '+52',  flag: '🇲🇽', name: 'MX',  tz: ['America/Mexico_City', 'America/Monterrey'] },
  { code: '+61',  flag: '🇦🇺', name: 'AU',  tz: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth'] },
  { code: '+64',  flag: '🇳🇿', name: 'NZ',  tz: ['Pacific/Auckland'] },
  { code: '+7',   flag: '🇷🇺', name: 'RU',  tz: ['Europe/Moscow', 'Asia/Yekaterinburg'] },
  { code: '+92',  flag: '🇵🇰', name: 'PK',  tz: ['Asia/Karachi'] },
  { code: '+880', flag: '🇧🇩', name: 'BD',  tz: ['Asia/Dhaka'] },
  { code: '+62',  flag: '🇮🇩', name: 'ID',  tz: ['Asia/Jakarta', 'Asia/Makassar'] },
  { code: '+60',  flag: '🇲🇾', name: 'MY',  tz: ['Asia/Kuala_Lumpur'] },
  { code: '+65',  flag: '🇸🇬', name: 'SG',  tz: ['Asia/Singapore'] },
  { code: '+66',  flag: '🇹🇭', name: 'TH',  tz: ['Asia/Bangkok'] },
  { code: '+84',  flag: '🇻🇳', name: 'VN',  tz: ['Asia/Ho_Chi_Minh'] },
  { code: '+63',  flag: '🇵🇭', name: 'PH',  tz: ['Asia/Manila'] },
  { code: '+20',  flag: '🇪🇬', name: 'EG',  tz: ['Africa/Cairo'] },
  { code: '+27',  flag: '🇿🇦', name: 'ZA',  tz: ['Africa/Johannesburg'] },
  { code: '+234', flag: '🇳🇬', name: 'NG',  tz: ['Africa/Lagos'] },
  { code: '+254', flag: '🇰🇪', name: 'KE',  tz: ['Africa/Nairobi'] },
  { code: '+31',  flag: '🇳🇱', name: 'NL',  tz: ['Europe/Amsterdam'] },
  { code: '+46',  flag: '🇸🇪', name: 'SE',  tz: ['Europe/Stockholm'] },
  { code: '+47',  flag: '🇳🇴', name: 'NO',  tz: ['Europe/Oslo'] },
  { code: '+45',  flag: '🇩🇰', name: 'DK',  tz: ['Europe/Copenhagen'] },
  { code: '+358', flag: '🇫🇮', name: 'FI',  tz: ['Europe/Helsinki'] },
  { code: '+41',  flag: '🇨🇭', name: 'CH',  tz: ['Europe/Zurich'] },
  { code: '+43',  flag: '🇦🇹', name: 'AT',  tz: ['Europe/Vienna'] },
  { code: '+32',  flag: '🇧🇪', name: 'BE',  tz: ['Europe/Brussels'] },
  { code: '+351', flag: '🇵🇹', name: 'PT',  tz: ['Europe/Lisbon'] },
  { code: '+48',  flag: '🇵🇱', name: 'PL',  tz: ['Europe/Warsaw'] },
  { code: '+90',  flag: '🇹🇷', name: 'TR',  tz: ['Europe/Istanbul'] },
  { code: '+972', flag: '🇮🇱', name: 'IL',  tz: ['Asia/Jerusalem'] },
  { code: '+966', flag: '🇸🇦', name: 'SA',  tz: ['Asia/Riyadh'] },
  { code: '+971', flag: '🇦🇪', name: 'AE',  tz: ['Asia/Dubai'] },
  { code: '+98',  flag: '🇮🇷', name: 'IR',  tz: ['Asia/Tehran'] },
  { code: '+94',  flag: '🇱🇰', name: 'LK',  tz: ['Asia/Colombo'] },
  { code: '+95',  flag: '🇲🇲', name: 'MM',  tz: ['Asia/Rangoon', 'Asia/Yangon'] },
  { code: '+977', flag: '🇳🇵', name: 'NP',  tz: ['Asia/Kathmandu', 'Asia/Katmandu'] },
  { code: '+54',  flag: '🇦🇷', name: 'AR',  tz: ['America/Argentina/Buenos_Aires'] },
  { code: '+56',  flag: '🇨🇱', name: 'CL',  tz: ['America/Santiago'] },
  { code: '+57',  flag: '🇨🇴', name: 'CO',  tz: ['America/Bogota'] },
  { code: '+51',  flag: '🇵🇪', name: 'PE',  tz: ['America/Lima'] },
]

function detectDefaultCountry(): CountryCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return COUNTRIES.find((c) => c.tz.includes(tz)) ?? COUNTRIES[0]
  } catch {
    return COUNTRIES[0]
  }
}

const ACCENT = '#6366f1'

export function PhoneStep({ onRegistered, onUnregistered }: Props) {
  const [selected, setSelected] = useState<CountryCode>(detectDefaultCountry)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fullPhone = `${selected.code}${phone.replace(/[\s\-\(\)]/g, '')}`
  const canSubmit = phone.trim().length >= 4

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const { registered } = await authApi.checkPhone(fullPhone)
      if (registered) onRegistered(fullPhone)
      else onUnregistered(fullPhone)
    } catch {
      setError('Could not check phone. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'white', borderRadius: 16, padding: '36px 28px', width: '100%', maxWidth: 380, border: '1px solid #e4e4e7' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: '#18181b', margin: '0 0 4px' }}>HomeJira</h1>
        <p style={{ color: '#71717a', fontSize: 13 }}>Enter your phone number to continue</p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <select
            value={`${selected.flag}|${selected.code}|${selected.name}`}
            onChange={(e) => {
              const [flag, code, name] = e.target.value.split('|')
              setSelected({ flag, code, name, tz: [] })
            }}
            style={{
              height: '100%', padding: '10px 24px 10px 10px', borderRadius: 8, fontSize: 14,
              border: '1px solid #e4e4e7', outline: 'none', background: '#f9f9f9',
              appearance: 'none', WebkitAppearance: 'none',
              cursor: 'pointer', fontWeight: 600, color: '#18181b',
            }}
          >
            {COUNTRIES.map((c, i) => (
              <option key={`${c.name}-${i}`} value={`${c.flag}|${c.code}|${c.name}`}>
                {c.flag} {c.code} {c.name}
              </option>
            ))}
          </select>
          <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 9, color: '#a1a1aa' }}>▼</span>
        </div>

        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="555 000 0000"
          autoFocus
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 14,
            border: '1px solid #e4e4e7', outline: 'none', background: '#f9f9f9',
            color: '#18181b', minWidth: 0,
          }}
        />
      </div>

      {phone.trim() && (
        <p style={{ fontSize: 11, color: '#a1a1aa', marginTop: 5, textAlign: 'center' }}>{fullPhone}</p>
      )}

      {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading || !canSubmit}
        style={{
          width: '100%', marginTop: 14, padding: '12px 0', borderRadius: 8, border: 'none',
          background: loading || !canSubmit ? '#e4e4e7' : ACCENT,
          color: loading || !canSubmit ? '#a1a1aa' : 'white',
          fontSize: 14, fontWeight: 700, cursor: loading || !canSubmit ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
      >{loading ? 'Checking…' : 'Continue'}</button>
    </div>
  )
}
