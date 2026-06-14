import { useState } from 'react'
import heroImage from './assets/hero.png'
import rulesText from '../f1_fantasy_rules.md?raw'
import './App.css'
import { copyText, getUiLanguage, setUiLanguage } from './lib/presentation'
import { Navigation } from './components/Navigation'
import { ValueChip } from './components/ValueChip'
import { useGame } from './context/useGame'
import { Dashboard } from './views/Dashboard'
import { SeasonSummary } from './views/SeasonSummary'
import { Standings } from './views/Standings'
import { Transfer } from './views/Transfer'

function renderInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  // Match **bold** or *italic* — ** is tried first so it doesn't get consumed by single *
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[2] !== undefined) {
      parts.push(<strong key={parts.length}>{match[2]}</strong>)
    } else if (match[3] !== undefined) {
      parts.push(<em key={parts.length}>{match[3]}</em>)
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? <>{parts}</> : text
}

function renderRulesText(text: string) {
  const language = getUiLanguage()
  let currentSection: 'en' | 'zh' | null = null

  return text.split('\n').map((line, index) => {
    const trimmed = line.trim()

    // Track language sections
    if (trimmed === '<!-- en -->') {
      currentSection = 'en'
      return null
    }
    if (trimmed === '<!-- zh -->') {
      currentSection = 'zh'
      return null
    }

    // Skip lines that don't belong to the current language
    if (currentSection !== language) {
      return null
    }

    if (!trimmed || trimmed === '---') {
      return null
    }

    // Check from most-specific to least-specific so #### / ### / ## / # don't overlap
    if (trimmed.startsWith('#### ')) {
      return <h4 key={index}>{renderInlineMarkdown(trimmed.slice(5))}</h4>
    }

    if (trimmed.startsWith('### ')) {
      return <h4 key={index}>{renderInlineMarkdown(trimmed.slice(4))}</h4>
    }

    if (trimmed.startsWith('## ')) {
      return <h3 key={index}>{renderInlineMarkdown(trimmed.slice(3))}</h3>
    }

    if (trimmed.startsWith('# ')) {
      return <h2 key={index}>{renderInlineMarkdown(trimmed.slice(2))}</h2>
    }

    if (trimmed.startsWith('> ')) {
      return <p key={index} className="rules-modal__note">{renderInlineMarkdown(trimmed.slice(2))}</p>
    }

    if (trimmed.startsWith('*   ') || trimmed.startsWith('- ')) {
      const content = trimmed.replace(/^\*\s{3}|^-\s/, '')
      return <p key={index} className="rules-modal__bullet">{renderInlineMarkdown(content)}</p>
    }

    return <p key={index}>{renderInlineMarkdown(trimmed)}</p>
  })
}

function SeasonSelect() {
  const { seasonCatalog, selectSeason, hasSavedGame, loadSavedGame } = useGame()
  const [showRules, setShowRules] = useState(false)

  return (
    <main className="season-select">
      <section className="season-select__hero">
        <div className="season-select__copy">
          <h1 className="season-select__title">
            F1 Fantasy Loacl Edition
          </h1>
          <p className="season-select__blurb">
            {copyText(
              'Relive any season from 2018–2025. Pick your drivers, manage the budget, play chips, and race AI managers across a full calendar.',
              '从 2018 到 2025 任选一个完整赛季，掌管一支属于你的梦幻车队。调配五位车手与两支制造商，在真实历史赛历的每一站中运筹预算、使用策略芯片、与 AI 经理同场竞技。',
            )}
          </p>
          <div className="season-select__actions">
            {hasSavedGame ? (
              <button type="button" className="action-button" onClick={loadSavedGame}>
                {copyText('Continue saved game', '继续游戏')}
              </button>
            ) : null}
            <button type="button" className="secondary-button" onClick={() => setShowRules(true)}>
              {copyText('Rules', '规则')}
            </button>
          </div>
        </div>
        <img src={heroImage} alt="" className="season-select__image" />
      </section>

      <section className="season-select__grid">
        {seasonCatalog.map((entry) => (
          <button
            key={`${entry.source}-${entry.season}`}
            type="button"
            className="season-card"
            onClick={() => selectSeason(entry.season)}
          >
            <span>
              {entry.source === 'json'
                ? copyText('Real season', '真实赛季')
                : copyText('Dev fixture', '开发样例')}
            </span>
            <strong>{entry.season}</strong>
            <small>
              {copyText(
                `${entry.data.rounds.length} rounds available`,
                `共 ${entry.data.rounds.length} 站`,
              )}
            </small>
          </button>
        ))}
      </section>

      {showRules ? (
        <div className="overlay-backdrop" role="presentation" onClick={() => setShowRules(false)}>
          <section
            className="modal-panel modal-panel--wide rules-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel__header">
              <div>
                <p className="panel__kicker">{copyText('Reference', '参考')}</p>
                <h3>{copyText('Game rules', '游戏规则')}</h3>
              </div>
              <button type="button" className="secondary-button" onClick={() => setShowRules(false)}>
                {copyText('Close', '关闭')}
              </button>
            </div>
            <div className="rules-modal__content">{renderRulesText(rulesText)}</div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function AppShell() {
  const {
    currentRoundData,
    exitToSeasonSelect,
    getTransferSummary,
    humanManager,
    processCurrentRound,
    saveGame,
    selectedSeasonEntry,
    setCurrentView,
    state,
  } = useGame()
  const [language, setLanguage] = useState(getUiLanguage())
  const [isLoadingWeekend, setIsLoadingWeekend] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [autoNavigate, setAutoNavigate] = useState(() => {
    try {
      return localStorage.getItem('f1_fantasy_auto_navigate') !== 'false'
    } catch {
      return true
    }
  })

  if (!selectedSeasonEntry || !humanManager) {
    return null
  }

  const transferSummary = getTransferSummary(humanManager.id)
  const switchLanguage = (nextLanguage: 'en' | 'zh') => {
    setUiLanguage(nextLanguage)
    setLanguage(nextLanguage)
  }
  const loadWeekend = () => {
    if (state.isSeasonComplete) {
      processCurrentRound()
      return
    }

    setIsLoadingWeekend(true)
    window.setTimeout(() => {
      processCurrentRound()
      setIsLoadingWeekend(false)
    }, 1400)
  }

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-block">
          <p>F1 Fantasy</p>
          <strong>{selectedSeasonEntry.season}</strong>
        </div>

        <Navigation
          currentView={state.currentView}
          onNavigate={(view) => setCurrentView(view)}
        />

        <div className="sidebar-summary">
          <article className="sidebar-bank">
            <span>{copyText('Bank', '预算余额')}</span>
            <strong>${humanManager.budget.toFixed(1)}M</strong>
          </article>
        </div>

        <div className="settings-area">
          <button
            type="button"
            className="secondary-button settings-toggle"
            onClick={() => setShowSettings(!showSettings)}
          >
            {copyText('Settings', '设置')}
          </button>
          {showSettings ? (
            <div className="settings-dropdown">
              <div className="settings-dropdown__group">
                <span className="settings-dropdown__label">{copyText('Language', '语言')}</span>
                <div className="settings-dropdown__lang">
                  <button
                    type="button"
                    className={language === 'en' ? 'is-active' : ''}
                    onClick={() => switchLanguage('en')}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    className={language === 'zh' ? 'is-active' : ''}
                    onClick={() => switchLanguage('zh')}
                  >
                    中文
                  </button>
                </div>
              </div>
              <div className="settings-dropdown__group">
                <label className="settings-dropdown__toggle">
                  <input
                    type="checkbox"
                    checked={autoNavigate}
                    onChange={() => {
                      const next = !autoNavigate
                      setAutoNavigate(next)
                      try {
                        localStorage.setItem('f1_fantasy_auto_navigate', String(next))
                      } catch {
                        // silently fail
                      }
                    }}
                  />
                  <span>
                    {copyText(
                      'Auto-navigate to dashboard after weekend processing',
                      '结算周末后自动回到总览',
                    )}
                  </span>
                </label>
              </div>
            </div>
          ) : null}
        </div>

        <button type="button" className="secondary-button" onClick={saveGame}>
          {copyText('Save', '保存')}
        </button>
        <button type="button" className="secondary-button" onClick={exitToSeasonSelect}>
          {copyText('Exit', '退出')}
        </button>
      </aside>

      <section className="app-main">
        <header className="hud-bar">
          <div className="hud-bar__left">
            <ValueChip label={copyText('Bank', '预算')} value={`$${humanManager.budget.toFixed(1)}M`} />
            <ValueChip
              label={copyText('Total Points', '总积分')}
              value={`${humanManager.totalPoints.toFixed(0)} pts`}
            />
            <ValueChip
              label={copyText('Transfers', '转会')}
              value={`${transferSummary.transfersUsed}/${humanManager.freeTransfers}`}
              tone={transferSummary.penalty < 0 ? 'warning' : 'neutral'}
            />
          </div>
          <div className="hud-bar__center">
            <span className="hud-pulse" />
            <strong>{selectedSeasonEntry.season} SEASON</strong>
          </div>
          <div className="hud-bar__right">
            <button
              type="button"
              className="action-button"
              onClick={loadWeekend}
              disabled={
                isLoadingWeekend ||
                (!state.isSeasonComplete && (!currentRoundData || !transferSummary.canProcess))
              }
            >
              {isLoadingWeekend
                ? copyText('Loading weekend...', '正在加载周末...')
                : state.isSeasonComplete
                ? copyText('Open Season Wrap-Up', '打开赛季结算')
                : currentRoundData
                ? copyText('Load & Process Weekend', '加载并结算本周末')
                : copyText('No Remaining Rounds', '没有剩余分站')}
            </button>
          </div>
        </header>

        <header className="app-header">
          <div>
            <p className="app-header__meta">
              {copyText('Historical race wall', '历史赛季比赛墙')}
            </p>
            <h1>
              {currentRoundData
                ? `ROUND ${currentRoundData.round}: ${currentRoundData.raceName}`
                : copyText(
                    `${selectedSeasonEntry.season} championship complete`,
                    `${selectedSeasonEntry.season} 赛季已结束`,
                  )}
            </h1>
          </div>
          <div className="app-header__status">
            <span>
              {currentRoundData
                ? currentRoundData.country
                : copyText('Season complete', '赛季结束')}
            </span>
            <strong>
              {currentRoundData?.date ??
                copyText(
                  `${state.seasonData?.rounds.length ?? 0} rounds processed`,
                  `已处理 ${state.seasonData?.rounds.length ?? 0} 站`,
                )}
            </strong>
          </div>
        </header>

        {state.currentView === 'dashboard' ? <Dashboard /> : null}
        {state.currentView === 'transfer' ? <Transfer /> : null}
        {state.currentView === 'standings' ? <Standings /> : null}
        {state.currentView === 'seasonSummary' ? <SeasonSummary /> : null}
      </section>

      {isLoadingWeekend ? (
        <div className="overlay-backdrop" role="presentation">
          <section className="modal-panel modal-panel--loading" role="status" aria-live="polite">
            <span className="loading-spinner" aria-hidden="true" />
            <div>
              <p className="panel__kicker">{copyText('Race control', '赛事控制')}</p>
              <h3>{copyText('Loading weekend simulation', '正在加载周末模拟')}</h3>
              <p className="muted-copy">
                {copyText(
                  'Timing sheets, pit stops, and fantasy scores are being processed.',
                  '正在处理计时表、进站数据和 Fantasy 得分。',
                )}
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function App() {
  const { state } = useGame()

  return state.currentView === 'seasonSelect' || !state.selectedSeason ? (
    <SeasonSelect />
  ) : (
    <AppShell />
  )
}

export default App
