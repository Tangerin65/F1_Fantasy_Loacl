interface TrendArrowProps {
  delta: number
}

export function TrendArrow({ delta }: TrendArrowProps) {
  if (delta === 0) {
    return <span className="trend-arrow trend-arrow--flat">-</span>
  }

  if (delta > 0) {
    return <span className="trend-arrow trend-arrow--up">↑{Math.abs(delta)}</span>
  }

  return <span className="trend-arrow trend-arrow--down">↓{Math.abs(delta)}</span>
}
