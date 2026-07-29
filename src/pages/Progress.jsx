import { useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { todayKey, humanDate } from '../utils/dates'
import { resizeImageToDataUrl } from '../utils/image'
import Sheet from '../components/Sheet'
import ConfirmDialog from '../components/ConfirmDialog'
import Icon from '../components/Icon'

export default function Progress() {
  const { data, addPhoto, deletePhoto } = useApp()
  const fileRef = useRef(null)
  const [pending, setPending] = useState(null) // { dataUrl, width, height }
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayKey())
  const [addOpen, setAddOpen] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [selected, setSelected] = useState([])
  const [viewing, setViewing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [busy, setBusy] = useState(false)

  const photos = [...data.photos].sort((a, b) => b.date.localeCompare(a.date))

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const { dataUrl, width, height } = await resizeImageToDataUrl(file)
      setPending({ dataUrl, width, height })
      setDate(todayKey())
      setNote('')
      setAddOpen(true)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  const save = () => {
    if (!pending) return
    addPhoto({ date, note, dataUrl: pending.dataUrl, width: pending.width, height: pending.height })
    setAddOpen(false)
    setPending(null)
  }

  const toggleSelect = (photo) => {
    if (!compareMode) { setViewing(photo); return }
    setSelected((prev) => {
      if (prev.includes(photo.id)) return prev.filter((id) => id !== photo.id)
      if (prev.length >= 2) return [prev[1], photo.id]
      return [...prev, photo.id]
    })
  }

  const compared = selected.map((id) => photos.find((p) => p.id === id)).filter(Boolean)

  return (
    <div className="page">
      <div className="page-header row" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="eyebrow">Progress</div>
          <h1>Photo timeline</h1>
        </div>
        {photos.length >= 2 && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setCompareMode((c) => !c); setSelected([]) }}
          >
            {compareMode ? 'Cancel' : 'Compare'}
          </button>
        )}
      </div>

      <p className="muted text-sm" style={{ marginBottom: 16 }}>
        A private timeline just for you — photos never leave this device and nothing here judges how you look, it's simply for comparing two moments side by side.
      </p>

      {compareMode && (
        <div className="card" style={{ marginBottom: 16 }}>
          {compared.length === 2 ? (
            <div>
              <div style={{ display: 'flex', gap: 8 }}>
                {compared.map((p) => (
                  <div key={p.id} style={{ flex: 1 }}>
                    <img src={p.dataUrl} alt="" style={{ width: '100%', borderRadius: 'var(--radius-md)', display: 'block' }} />
                    <div className="text-sm muted mono" style={{ textAlign: 'center', marginTop: 6 }}>{humanDate(p.date)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm muted" style={{ textAlign: 'center', padding: '10px 0' }}>
              Select {2 - compared.length} more photo{2 - compared.length === 1 ? '' : 's'} to compare.
            </p>
          )}
        </div>
      )}

      <button className="btn btn-primary btn-block" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? 'Processing…' : '+ Add photo'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />

      {photos.length === 0 ? (
        <div className="empty-state">
          <div className="icon"><Icon name="camera" size={26} /></div>
          <p>No photos yet. Add your first to start your timeline.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 18 }}>
          {photos.map((p) => {
            const isSelected = selected.includes(p.id)
            return (
              <button
                key={p.id}
                onClick={() => toggleSelect(p)}
                style={{
                  position: 'relative', aspectRatio: '1', border: 'none', padding: 0, borderRadius: 'var(--radius-md)',
                  overflow: 'hidden', cursor: 'pointer',
                  outline: isSelected ? '3px solid var(--accent)' : 'none', outlineOffset: 2,
                }}
              >
                <img src={p.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <span
                  className="mono"
                  style={{
                    position: 'absolute', bottom: 4, left: 4, fontSize: 10, color: '#fff',
                    background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: 6,
                  }}
                >
                  {p.date.slice(5)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <Sheet open={addOpen} onClose={() => { setAddOpen(false); setPending(null) }} title="Add photo">
        {pending && (
          <>
            <img src={pending.dataUrl} alt="" style={{ width: '100%', borderRadius: 'var(--radius-md)', marginBottom: 16, maxHeight: 320, objectFit: 'cover' }} />
            <div className="field">
              <label>Date</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Note (optional)</label>
              <input className="input" type="text" placeholder="e.g. week 4" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-block" onClick={save}>Save to timeline</button>
          </>
        )}
      </Sheet>

      <Sheet open={!!viewing} onClose={() => setViewing(null)} title={viewing ? humanDate(viewing.date) : ''}>
        {viewing && (
          <>
            <img src={viewing.dataUrl} alt="" style={{ width: '100%', borderRadius: 'var(--radius-md)', marginBottom: 14 }} />
            {viewing.note && <p className="text-sm muted" style={{ marginBottom: 14 }}>{viewing.note}</p>}
            <button className="btn btn-danger btn-block" onClick={() => setConfirmDelete(viewing)}>Delete photo</button>
          </>
        )}
      </Sheet>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete photo?"
        message="This can't be undone."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => { deletePhoto(confirmDelete.id); setConfirmDelete(null); setViewing(null) }}
      />
    </div>
  )
}
