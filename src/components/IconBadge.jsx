import Icon from './Icon'

// Small circular colored icon badge for representing categories (nutrition
// items, habit types, etc.) — distinct from the single-accent icon dots
// used elsewhere, since here each category gets its own color.
export default function IconBadge({ icon, color = 'var(--accent)', size = 34, iconSize = 16 }) {
  return (
    <span
      className="icon-badge"
      style={{
        width: size, height: size,
        color,
        background: `color-mix(in srgb, ${color} 20%, transparent)`,
      }}
    >
      <Icon name={icon} size={iconSize} />
    </span>
  )
}
