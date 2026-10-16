import { useState } from 'react'
import Sheet from './Sheet'
import Icon from './Icon'
import { tx } from '../i18n/tx'
import { useT } from '../i18n/useT'

// Earlier conversations with the coach: tap one to continue it, the bin
// to delete it (asks first). The current conversation can be wiped here
// too. What the coach has learned about you stays either way.
export default function CoachThreadsSheet({ open, onClose, current, threads, onOpen, onDelete, onClearCurrent }) {
  const { locale } = useT()
  const [confirm, setConfirm] = useState(null) // thread id | 'current'
  const when = (at) => new Date(at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  const currentTitle = (current.find((m) => m.role === 'user')?.content || '').slice(0, 60)

  const close = () => { setConfirm(null); onClose() }

  return (
    <Sheet open={open} onClose={close} title={tx("Gesprekken")}>
      <div className="stack" style={{ gap: 12 }}>
        <p className="text-sm faint" style={{ margin: 0 }}>
          {tx("Wat je coach over je weet, blijft in elk gesprek bewaard.")}
        </p>

        {current.length > 0 && (
          <div className="card" style={{ padding: '12px 14px' }}>
            <div className="row" style={{ gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-sm" style={{ color: 'var(--accent)', fontWeight: 700 }}>{tx("Huidig gesprek")}</div>
                <div style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTitle || tx("Gesprek")}</div>
              </div>
              <button type="button" aria-label={tx("Verwijderen")} onClick={() => setConfirm('current')} style={binStyle}>
                <Icon name="trash" size={18} />
              </button>
            </div>
            {confirm === 'current' && <Confirm onNo={() => setConfirm(null)} onYes={() => { setConfirm(null); onClearCurrent() }} />}
          </div>
        )}

        {threads.length === 0 ? (
          <p className="text-sm muted" style={{ margin: 0 }}>{tx("Nog geen eerdere gesprekken. Met \"Nieuw gesprek\" bewaar je het huidige hier.")}</p>
        ) : (
          <div className="card" style={{ padding: '2px 14px' }}>
            {threads.map((t, i) => (
              <div key={t.id} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
                <div className="row" style={{ gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => onOpen(t.id)}
                    style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'var(--text)', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                    <div className="text-sm faint">{when(t.at)} · {t.messages.length} {tx("berichten")}</div>
                  </button>
                  <button type="button" aria-label={tx("Verwijderen")} onClick={() => setConfirm(t.id)} style={binStyle}>
                    <Icon name="trash" size={18} />
                  </button>
                </div>
                {confirm === t.id && <Confirm onNo={() => setConfirm(null)} onYes={() => { setConfirm(null); onDelete(t.id) }} />}
              </div>
            ))}
          </div>
        )}

        <button type="button" className="btn btn-secondary btn-block" onClick={close}>{tx("Sluiten")}</button>
      </div>
    </Sheet>
  )
}

const binStyle = { background: 'none', border: 'none', color: 'var(--text-soft)', cursor: 'pointer', padding: 6, flexShrink: 0 }

function Confirm({ onNo, onYes }) {
  return (
    <div className="row" style={{ gap: 8, marginTop: 10 }}>
      <span className="text-sm" style={{ flex: 1 }}>{tx("Dit gesprek verwijderen?")}</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onNo}>{tx("Nee")}</button>
      <button type="button" className="btn btn-primary btn-sm" style={{ background: 'var(--danger)' }} onClick={onYes}>{tx("Verwijderen")}</button>
    </div>
  )
}
