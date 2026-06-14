import { type ChipType } from '../types'
import { getChipDescription, getChipName, getChipStateLabel } from '../lib/presentation'

interface ChipBadgeProps {
  chip: ChipType
  active: boolean
  available: boolean
  onClick?: () => void
}

export function ChipBadge({ chip, active, available, onClick }: ChipBadgeProps) {
  const stateLabel = getChipStateLabel(available, active)
  const description = getChipDescription(chip)
  const name = getChipName(chip)

  return (
    <button
      type="button"
      className={`chip-badge${active ? ' is-active' : ''}${!available ? ' is-spent' : ''}`}
      onClick={onClick}
      disabled={!available}
      title={description}
    >
      <span className="chip-badge__help" aria-label={description}>?</span>
      <span className="chip-badge__tooltip" role="tooltip">{description}</span>
      <span className="chip-badge__name">{name}</span>
      <span className="chip-badge__state">{stateLabel}</span>
    </button>
  )
}
