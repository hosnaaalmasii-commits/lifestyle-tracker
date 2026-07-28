import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { THEME_PRESETS } from '../../utils/colorPresets'
import BackHeader from '../../components/BackHeader'
import SegmentedControl from '../../components/SegmentedControl'
import ColorPicker from '../../components/ColorPicker'
import ConfirmDialog from '../../components/ConfirmDialog'

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const FONT_OPTIONS = [
  { value: 'fraunces', label: 'Fraunces' },
  { value: 'playfair', label: 'Playfair' },
  { value: 'space', label: 'Modern' },
]

const DENSITY_OPTIONS = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
]

const COLOR_FIELDS = [
  { key: 'accent', label: 'Main accent' },
  { key: 'ring', label: 'Progress ring' },
  { key: 'water', label: 'Water section' },
  { key: 'sleep', label: 'Sleep section' },
  { key: 'workout', label: 'Workout section' },
]

export default function Settings({ onBack }) {
  const {
    data, setThemeMode, setColor, resetColors, applyThemePreset,
    setHeadingFont, setDensity, setUseGradientAccents,
    setWeightUnit, exportData, importData, clearAll,
  } = useApp()
  const importRef = useRef(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [importError, setImportError] = useState('')
  const [importedOk, setImportedOk] = useState(false)

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')
    setImportedOk(false)
    try {
      const text = await file.text()
      importData(text)
      setImportedOk(true)
    } catch {
      setImportError('Could not read that file — make sure it\'s a backup exported from this app.')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="page">
      <BackHeader eyebrow="More" title="Settings" onBack={onBack} />

      <div className="section-title">Appearance</div>
      <div className="card stack">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Theme</label>
          <SegmentedControl options={THEME_OPTIONS} value={data.settings.themeMode} onChange={setThemeMode} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Heading font</label>
          <SegmentedControl options={FONT_OPTIONS} value={data.settings.headingFont} onChange={setHeadingFont} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Layout density</label>
          <SegmentedControl options={DENSITY_OPTIONS} value={data.settings.density} onChange={setDensity} />
        </div>
        <div className="row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Gradient accents</div>
            <div className="text-sm faint">Blend the ring &amp; primary buttons into a second color</div>
          </div>
          <button
            className={`switch${data.settings.useGradientAccents ? ' on' : ''}`}
            onClick={() => setUseGradientAccents(!data.settings.useGradientAccents)}
            aria-label="Gradient accents"
          />
        </div>
      </div>

      <div className="section-title">Theme presets</div>
      <div className="scroll-x">
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => applyThemePreset(preset.colors)}
            style={{
              flexShrink: 0, width: 92, background: 'var(--surface)', border: '1px solid var(--border-soft)',
              borderRadius: 'var(--radius-md)', padding: '12px 8px', cursor: 'pointer', textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', gap: -6 }}>
              {[preset.colors.accent, preset.colors.water, preset.colors.workout].map((c, i) => (
                <span
                  key={i}
                  style={{
                    width: 22, height: 22, borderRadius: '50%', background: c,
                    border: '2px solid var(--surface)', marginLeft: i === 0 ? 0 : -8,
                  }}
                />
              ))}
            </div>
            <div className="text-sm" style={{ marginTop: 8, fontWeight: 600, lineHeight: 1.2 }}>{preset.name}</div>
          </button>
        ))}
      </div>

      <div className="section-title">Colors</div>
      <div className="card">
        {COLOR_FIELDS.map((f) => (
          <ColorPicker key={f.key} label={f.label} value={data.settings.colors[f.key]} onChange={(hex) => setColor(f.key, hex)} />
        ))}
        {data.settings.useGradientAccents && (
          <ColorPicker label="Gradient end" value={data.settings.colors.gradientEnd} onChange={(hex) => setColor('gradientEnd', hex)} />
        )}
        <button className="btn btn-ghost btn-sm" onClick={resetColors}>Reset to defaults</button>
      </div>

      <div className="section-title">Units</div>
      <div className="card">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Weight unit</label>
          <SegmentedControl
            options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]}
            value={data.settings.weightUnit}
            onChange={setWeightUnit}
          />
        </div>
      </div>

      <div className="section-title">Your data</div>
      <div className="card stack">
        <div className="row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Export backup</div>
            <div className="text-sm faint">Save everything as a JSON file</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={exportData}>Export</button>
        </div>
        <div className="row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Import backup</div>
            <div className="text-sm faint">Replace current data from a file</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => importRef.current?.click()}>Import</button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
        </div>
        {importedOk && <div className="text-sm" style={{ color: 'var(--success)' }}>Backup imported successfully.</div>}
        {importError && <div className="text-sm" style={{ color: 'var(--danger)' }}>{importError}</div>}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Clear everything</div>
            <div className="text-sm faint">Erase all local data on this device</div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmClear(true)}>Clear</button>
        </div>
      </div>

      <p className="text-sm faint" style={{ textAlign: 'center', margin: '28px 0 8px' }}>
        Lifestyle Tracker · data stays on this device
      </p>

      <ConfirmDialog
        open={confirmClear}
        title="Clear everything?"
        message="This permanently deletes all water, sleep, workout, weight, mood, nutrition and photo data on this device. This can't be undone."
        confirmLabel="Clear everything"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => { clearAll(); setConfirmClear(false) }}
      />
    </div>
  )
}
