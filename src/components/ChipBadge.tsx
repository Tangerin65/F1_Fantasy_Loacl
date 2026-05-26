import { CHIP_NAMES, type ChipType } from '../types'

interface ChipBadgeProps {
  chip: ChipType
  active: boolean
  available: boolean
  onClick?: () => void
}

export function ChipBadge({ chip, active, available, onClick }: ChipBadgeProps) {
  return (
    <button
      type="button"
      className={`chip-badge${active ? ' is-active' : ''}${!available ? ' is-spent' : ''}`}
      onClick={onClick}
      disabled={!available}
      title={CHIP_NAMES[chip]}
    >
      <span className="chip-badge__name">{CHIP_NAMES[chip]}</span>
      <span className="chip-badge__state">{!available ? 'Spent' : active ? 'Armed' : 'Ready'}</span>
    </button>
  )
}
