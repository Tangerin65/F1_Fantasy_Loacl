import type { CSSProperties } from 'react'
import { Sparkline } from './Sparkline'

interface DriverCardProps {
  title: string
  subtitle: string
  price: number
  points: number
  lastScore?: number
  recentScores: number[]
  highlight?: string
  tag?: string
  accent?: 'red' | 'cyan' | 'gold'
  isDrs?: boolean
  onClick?: () => void
  style?: CSSProperties
}

const formatMoney = (value: number) => `$${value.toFixed(1)}M`

export function DriverCard({
  title,
  subtitle,
  price,
  points,
  lastScore,
  recentScores,
  highlight,
  tag,
  accent = 'red',
  isDrs = false,
  onClick,
  style,
}: DriverCardProps) {
  const cardClassName = `asset-card${isDrs ? ' is-drs' : ''}${onClick ? ' asset-card--interactive' : ''}`

  const content = (
    <>
      <div className="asset-card__head">
        <div>
          <p className="asset-card__eyebrow">{subtitle}</p>
          <h3>{title}</h3>
        </div>
        {tag ? <span className={`asset-card__tag${isDrs ? ' asset-card__tag--drs' : ''}`}>{tag}</span> : null}
      </div>
      <div className="asset-card__metrics">
        <div>
          <span>Price</span>
          <strong>{formatMoney(price)}</strong>
        </div>
        <div>
          <span>Season</span>
          <strong>{points.toFixed(0)} pts</strong>
        </div>
        {lastScore !== undefined ? (
          <div>
            <span>Last</span>
            <strong>{lastScore.toFixed(0)} pts</strong>
          </div>
        ) : null}
      </div>
      <Sparkline values={recentScores} accent={accent} />
      {highlight ? <p className="asset-card__highlight">{highlight}</p> : null}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className={cardClassName} onClick={onClick} style={style}>
        {content}
      </button>
    )
  }

  return (
    <article className={cardClassName} style={style}>
      {content}
    </article>
  )
}
