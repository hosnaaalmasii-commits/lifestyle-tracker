export default function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="segmented-control">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`segmented-btn${active ? ' active' : ''}`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
