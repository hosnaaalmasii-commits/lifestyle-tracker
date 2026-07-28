import { weekdayShort, isToday } from '../utils/dates'

// values: [{ key, value }], goal: number for the reference line
export default function WeeklyBarChart({ values, goal, color = 'var(--accent)', unit = '', height = 120, formatValue }) {
  const max = Math.max(goal || 0, ...values.map((v) => v.value), 1)
  const goalRatio = goal ? Math.min(goal / max, 1) : null

  return (
    <div>
      <div style={{ position: 'relative', height, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        {goalRatio != null && (
          <div
            style={{
              position: 'absolute', left: 0, right: 0,
              bottom: `${goalRatio * 100}%`,
              borderTop: '1.5px dashed var(--text-faint)',
            }}
          />
        )}
        {values.map((v) => {
          const ratio = max > 0 ? v.value / max : 0
          const met = goal ? v.value >= goal : false
          return (
            <div key={v.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 6 }}>
              <div
                title={formatValue ? formatValue(v.value) : String(v.value)}
                style={{
                  width: '100%',
                  maxWidth: 26,
                  height: `${Math.max(ratio * 100, v.value > 0 ? 4 : 0)}%`,
                  borderRadius: 7,
                  background: met ? color : `color-mix(in srgb, ${color} 40%, transparent)`,
                  transition: 'height 0.5s cubic-bezier(.4,0,.2,1)',
                }}
              />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {values.map((v) => (
          <div
            key={v.key}
            className="mono"
            style={{
              flex: 1, textAlign: 'center', fontSize: 11,
              color: isToday(v.key) ? 'var(--text)' : 'var(--text-faint)',
              fontWeight: isToday(v.key) ? 700 : 400,
            }}
          >
            {weekdayShort(v.key)[0]}
          </div>
        ))}
      </div>
    </div>
  )
}
