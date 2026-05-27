interface ValueChipProps {
  label: string
  value: string
  tone?: 'neutral' | 'positive' | 'warning' | 'accent'
}

export function ValueChip({ label, value, tone = 'neutral' }: ValueChipProps) {
  return (
    <article className={`value-chip value-chip--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

