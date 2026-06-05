// Exibe a nota média e a contagem de avaliações de um filme.
export default function RatingBadge({ average = 0, total = 0 }) {
  const hasReviews = total > 0
  return (
    <div className="rating-badge" title={`${total} avaliação(ões)`}>
      <span className="rating-badge__star">★</span>
      <span className="rating-badge__value">
        {hasReviews ? average.toFixed(1) : '—'}
      </span>
      <span className="rating-badge__count">
        {hasReviews ? `(${total})` : 'sem avaliações'}
      </span>
    </div>
  )
}
