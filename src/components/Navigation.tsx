import type { GameView } from '../types'
import { copyText } from '../lib/presentation'

interface NavigationProps {
  currentView: GameView
  onNavigate: (view: Exclude<GameView, 'seasonSelect'>) => void
}

const NAV_ITEMS: Array<{ view: Exclude<GameView, 'seasonSelect'>; label: string; shortLabel: string }> = [
  {
    view: 'dashboard',
    label: copyText('Dashboard', '总览'),
    shortLabel: copyText('Dash', '总览'),
  },
  {
    view: 'transfer',
    label: copyText('Transfer Center', '转会'),
    shortLabel: copyText('Transfer', '转会'),
  },
  {
    view: 'standings',
    label: copyText('Standings', '排行'),
    shortLabel: copyText('Table', '排行'),
  },
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
