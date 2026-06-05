import type { GameView } from '../types'
import { copyText } from '../lib/presentation'

interface NavigationProps {
  currentView: GameView
  onNavigate: (view: Exclude<GameView, 'seasonSelect'>) => void
}

interface NavItem {
  view: Exclude<GameView, 'seasonSelect'>
  labelEn: string
  labelZh: string
  shortLabelEn: string
  shortLabelZh: string
}

const NAV_ITEMS: NavItem[] = [
  { view: 'dashboard', labelEn: 'Dashboard', labelZh: '总览', shortLabelEn: 'Dash', shortLabelZh: '总览' },
  { view: 'transfer', labelEn: 'Transfer Center', labelZh: '转会', shortLabelEn: 'Transfer', shortLabelZh: '转会' },
  { view: 'standings', labelEn: 'Standings', labelZh: '排行', shortLabelEn: 'Table', shortLabelZh: '排行' },
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
          <span className="app-nav__label">{copyText(item.labelEn, item.labelZh)}</span>
          <span className="app-nav__label app-nav__label--short">{copyText(item.shortLabelEn, item.shortLabelZh)}</span>
        </button>
      ))}
    </nav>
  )
}
