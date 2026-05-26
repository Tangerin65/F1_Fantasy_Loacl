interface DriverCardProps {
  title: string
  subtitle: string
  price: number
  points: number
  highlight?: string
  tag?: string
}

const formatMoney = (value: number) => `$${value.toFixed(1)}M`

export function DriverCard({
  title,
  subtitle,
  price,
  points,
  highlight,
  tag,
}: DriverCardProps) {
  return (
    <article className="asset-card">
      <div className="asset-card__head">
        <div>
          <p className="asset-card__eyebrow">{subtitle}</p>
          <h3>{title}</h3>
        </div>
        {tag ? <span className="asset-card__tag">{tag}</span> : null}
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
      </div>
      {highlight ? <p className="asset-card__highlight">{highlight}</p> : null}
    </article>
  )
}
