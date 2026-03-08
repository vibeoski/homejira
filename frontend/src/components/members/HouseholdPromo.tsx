import { useState } from 'react'
import { coinsApi } from '../../api/coins'

export function HouseholdPromo() {
  const [sharingReferral, setSharingReferral] = useState(false)
  const [referralCopied, setReferralCopied] = useState(false)

  const handleShareReferral = async () => {
    setSharingReferral(true)
    try {
      const token = await coinsApi.getOrCreateReferralLink()
      const url = `https://homejira.app/refer/${token}`
      const shareTitle = 'Join me on HomeJira'
      const shareText = `I've been using HomeJira to manage household tasks with my family — it's really handy! Join me:`
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url })
      } else {
        await navigator.clipboard.writeText(`${shareText} ${url}`)
        setReferralCopied(true)
        setTimeout(() => setReferralCopied(false), 3000)
      }
    } catch {
      // user cancelled or clipboard failed — no-op
    } finally {
      setSharingReferral(false)
    }
  }

  return (
    <div style={{ padding: '0 12px 32px' }}>
      {/* Refer friends card */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e4e4e7', padding: '16px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
            🪙
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#18181b', margin: 0 }}>Love HomeJira?</p>
            <p style={{ fontSize: 11, color: '#71717a', margin: '2px 0 0' }}>Refer friends &amp; family — earn 10 coins each</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleShareReferral}
          disabled={sharingReferral}
          style={{
            width: '100%', padding: '9px 0', borderRadius: 8,
            border: '1px solid #e4e4e7',
            background: sharingReferral ? '#f4f4f5' : 'white',
            color: sharingReferral ? '#a1a1aa' : '#18181b',
            fontSize: 13, fontWeight: 600, cursor: sharingReferral ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          {sharingReferral ? 'Generating…' : referralCopied ? 'Link copied!' : 'Share with friends & family'}
        </button>
      </div>

    </div>
  )
}
