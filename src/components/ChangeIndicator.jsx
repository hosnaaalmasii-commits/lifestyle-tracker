import Icon from './Icon'

// Up/down delta pill, e.g. for "vs yesterday" or "vs last entry" comparisons.
// goodDirection controls which way is colored as positive — for most stats
// "up" is good, but for something like weight loss "down" is the goal.
export default function ChangeIndicator({ value, suffix = '', goodDirection = 'up' }) {
  if (value == null || Number.isNaN(value)) return null
  if (value === 0) {
    return <span className="change-indicator flat"><span className="mono">0{suffix}</span></span>
  }
  const isUp = value > 0
  const isGood = isUp ? goodDirection === 'up' : goodDirection === 'down'
  return (
    <span className={`change-indicator ${isGood ? 'good' : 'bad'}`}>
      <Icon name={isUp ? 'trendUp' : 'trendDown'} size={12} />
      <span className="mono">{isUp ? '+' : ''}{value}{suffix}</span>
    </span>
  )
}
