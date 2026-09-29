import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { TRIGGER_TYPES, getTriggerType, activeContractsToday } from '../../utils/habitContracts'
import BackHeader from '../../components/BackHeader'
import Sheet from '../../components/Sheet'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'
import { tx } from '../../i18n/tx'

export default function HabitContracts({ onBack }) {
  const { data, addHabitContract, deleteHabitContract } = useApp()
  const contracts = data.habitContracts
  const [addOpen, setAddOpen] = useState(false)
  const [toDelete, setToDelete] = useState(null)

  const activeIds = new Set(activeContractsToday(contracts, data).map((c) => c.id))

  return (
    <div className="page">
      <BackHeader
        eyebrow={tx("More")}
        title={tx("Habit Contracts")}
        onBack={onBack}
        action={<button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>{tx("+ New")}</button>}
      />
      <p className="muted text-sm" style={{ marginBottom: 18 }}>
        {tx("Small if-then agreements with yourself — decided in advance, so there's nothing to decide in the moment.")}
      </p>

      {contracts.length === 0 ? (
        <div className="empty-state">
          <div className="icon"><Icon name="handshake" size={26} /></div>
          <p>{tx("No contracts yet. Try \"If I slept poorly, I keep today light.\"")}</p>
        </div>
      ) : (
        <div className="stack">
          {contracts.map((c) => {
            const type = getTriggerType(c.triggerType)
            const active = activeIds.has(c.id)
            return (
              <div
                key={c.id}
                className="card"
                style={active ? { borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--border-soft))', background: 'color-mix(in srgb, var(--accent) 6%, var(--surface))' } : undefined}
              >
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div className="text-sm faint">{tx("If")} {type ? type.label.toLowerCase().replace(/^i /, '') : c.triggerType}{type?.hasParam ? ` (${c.param}h)` : ''}…</div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>{c.response}</div>
                  </div>
                  {active && <span className="tag" style={{ background: 'var(--accent)', color: 'var(--accent-contrast)', whiteSpace: 'nowrap' }}>{tx("Active today")}</span>}
                </div>
                <button
                  className="btn-ghost"
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13, marginTop: 10, padding: 0 }}
                  onClick={() => setToDelete(c)}
                >
                  {tx("Delete")}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <AddContractSheet open={addOpen} onClose={() => setAddOpen(false)} onSubmit={addHabitContract} />

      <ConfirmDialog
        open={!!toDelete}
        title={tx("Delete this contract?")}
        message={tx("This can't be undone.")}
        confirmLabel={tx("Delete")}
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => { deleteHabitContract(toDelete.id); setToDelete(null) }}
      />
    </div>
  )
}

function AddContractSheet({ open, onClose, onSubmit }) {
  const [triggerType, setTriggerType] = useState(TRIGGER_TYPES[0].id)
  const [param, setParam] = useState(TRIGGER_TYPES[0].defaultParam)
  const [response, setResponse] = useState('')

  const type = getTriggerType(triggerType)

  const selectType = (id) => {
    setTriggerType(id)
    const t = getTriggerType(id)
    setParam(t.defaultParam)
    setResponse('')
  }

  const submit = () => {
    onSubmit({ triggerType, param: type.hasParam ? param : undefined, response: response.trim() || type.templateResponse })
    onClose()
    setResponse('')
  }

  return (
    <Sheet open={open} onClose={onClose} title={tx("New habit contract")}>
      <div className="field">
        <label>{tx("If…")}</label>
        <div className="stack">
          {TRIGGER_TYPES.map((t) => (
            <button
              key={t.id}
              className={`chip${triggerType === t.id ? ' selected' : ''}`}
              style={{ textAlign: 'left', justifyContent: 'flex-start' }}
              onClick={() => selectType(t.id)}
            >
              {tx(t.label)}
            </button>
          ))}
        </div>
      </div>

      {type.hasParam && (
        <div className="field">
          <label>{type.paramLabel}</label>
          <div className="stepper">
            <button onClick={() => setParam((p) => Math.max(1, p - 1))}>−</button>
            <span className="value">{param}</span>
            <button onClick={() => setParam((p) => p + 1)}>+</button>
          </div>
        </div>
      )}

      <div className="field">
        <label>{tx("…then")}</label>
        <input
          className="input"
          type="text"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder={type.templateResponse}
        />
      </div>

      <button className="btn btn-primary btn-block" onClick={submit}>{tx("Save contract")}</button>
    </Sheet>
  )
}
