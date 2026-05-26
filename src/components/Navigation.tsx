import type { GameView } from '../types'

interface NavigationProps {
  currentView: GameView
  onNavigate: (view: Exclude<GameView, 'seasonSelect'>) => void
}

const NAV_ITEMS: Array<{ view: Exclude<GameView, 'seasonSelect'>; label: string; shortLabel: string }> = [
  { view: 'dashboard', label: 'Dashboard', shortLabel: 'Dash' },
  { view: 'transfer', label: 'Transfer Center', shortLabel: 'Transfer' },
  { view: 'raceControl', label: 'Race Control', shortLabel: 'Control' },
  { view: 'standings', label: 'Standings', shortLabel: 'Table' },
]

export function Navigation({ currentView, onNavigate }: NavigationProps) {
  return (
    <nav className="app-nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.view}
          type="button"
          className={`app-nav__button${currentView === item.view ? ' is-active' : ''}`}
          onClick={() => onNavigate(item.view)}
        >
          <span className="app-nav__label">{item.label}</span>
          <span className="app-nav__label app-nav__label--short">{item.shortLabel}</span>
        </button>
      ))}
    </nav>
  )
}
