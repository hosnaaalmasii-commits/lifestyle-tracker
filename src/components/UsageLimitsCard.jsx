import { useEffect, useState } from 'react'
import { getUsage, getLimits, setLimits, onUsageChanged } from '../utils/usageGuard'
import { tx } from '../i18n/tx'

// Settings → Kostenlimieten: this month's spend per paid service on this
// device, with an editable ceiling for each (enforced in usageGuard.js).
export default function UsageLimitsCard() {
  const [usage, setUsage] = useState(getUsage)
  const [limits, setLimitsState] = useState(getLimits)

  useEffect(() => onUsageChanged(() => { setUsage(getUsage()); setLimitsState(getLimits()) }), [])

  const rows = [
    { key: 'claudeUsd', label: 'Claude (coach, inspreken, schattingen)', used: usage.claudeUsd, unit: '$', step: 0.5 },
    { key: 'openaiUsd', label: 'OpenAI-stemmen', used: usage.openaiUsd, unit: '$', step: 0.5 },
    { key: 'elevenChars', label: 'ElevenLabs-stemmen (tekens)', used: usage.elevenChars, unit: '', step: 1000 },
  ]
  const fmt = (v, unit) => unit === '$' ? `$${v.toFixed(2)}` : Math.round(v).toLocaleString('nl-NL')

  return (
    <div className="card stack">
      <p className="text-sm muted" style={{ margin: 0 }}>
        {tx("Harde plafonds per maand op dit apparaat. Is een limiet bereikt, dan stuurt de app niets meer naar die dienst tot volgende maand (de coach praat dan met de stem van je toestel). Stel daarnaast ook bij de diensten zelf een limiet in — dat is de echte noodrem.")}
      </p>
      {rows.map((r) => {
        const limit = Number(limits[r.key]) || 0
        const pct = limit > 0 ? Math.min(100, (r.used / limit) * 100) : 100
        return (
          <div key={r.key} className="stack" style={{ gap: 6 }}>
            <div className="row" style={{ fontSize: 14 }}>
              <span style={{ fontWeight: 600 }}>{tx(r.label)}</span>
              <span className="mono text-sm">{fmt(r.used, r.unit)} / {fmt(limit, r.unit)}</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-soft)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct >= 90 ? 'var(--danger)' : 'var(--accent)' }} />
            </div>
            <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
              <span className="text-sm faint">{tx("Limiet")}</span>
              <input
                className="input"
                style={{ width: 120, padding: '6px 10px' }}
                type="number"
                min="0"
                step={r.step}
                value={limits[r.key]}
                onChange={(e) => setLimitsState(setLimits({ [r.key]: Math.max(0, Number(e.target.value) || 0) }))}
              />
              <span className="text-sm faint">{r.unit === '$' ? tx("dollar per maand") : tx("tekens per maand")}</span>
            </div>
          </div>
        )
      })}
      <div className="row" style={{ fontSize: 13 }}>
        <span className="muted">{tx("Claude-aanvragen vandaag")}</span>
        <span className="mono">{usage.claudeCallsToday} / {limits.claudeCallsPerDay}</span>
      </div>
      <p className="text-sm faint" style={{ margin: 0 }}>
        {tx("Bedragen zijn schattingen op basis van de officiële prijzen en tellen alleen dit apparaat. Zet een limiet op 0 om een dienst helemaal te blokkeren.")}
      </p>
    </div>
  )
}
