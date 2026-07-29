import Icon from './Icon'

// The week as an airplane seat map — filled seat = day completed, ringed
// seat = today. A genuinely different shape for the same "streak" data
// than a bar chart or a row of dots.
export default function WeeklyManifest({ days }) {
  return (
    <div className="manifest">
      {days.map((d) => (
        <div key={d.key} className={`seat${d.filled ? ' filled' : ''}${d.today ? ' today' : ''}`}>
          <div className="seat-cell">{d.filled && <Icon name="check" size={14} />}</div>
          <div className="seat-label">{d.label}</div>
        </div>
      ))}
    </div>
  )
}
