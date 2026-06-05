import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getMovie } from '../api/client.js'
import AddReviewForm from '../components/AddReviewForm.jsx'
import RatingBadge from '../components/RatingBadge.jsx'

export default function MovieDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    // GET /movies/{id} agrega no Gateway: GetMovie (A) + GetMovieRating (B) + GetMovieReviews (B).
    getMovie(id)
      .then(setData)
      .catch((err) =>
        setError(
          err?.response?.status === 404
            ? 'Filme não encontrado.'
            : 'Erro ao carregar o filme. Verifique se o Gateway está no ar.',
        ),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Atualiza a UI após uma nova avaliação sem refazer o fetch inteiro:
  // insere a review e recalcula a média localmente.
  const handleReviewAdded = (review) => {
    setData((prev) => {
      if (!prev) return prev
      const reviews = [...prev.reviews, review]
      const total = reviews.length
      const average = reviews.reduce((acc, r) => acc + r.rating, 0) / total
      return {
        ...prev,
        reviews,
        rating: { ...prev.rating, average, total_reviews: total },
      }
    })
  }

  if (loading) return <div className="state">Carregando…</div>
  if (error)
    return (
      <div className="state state--error">
        <p>{error}</p>
        <Link to="/" className="btn">← Voltar</Link>
      </div>
    )

  const { movie, rating, reviews } = data

  return (
    <article className="detail">
      <Link to="/" className="back-link">← Voltar ao catálogo</Link>

      <div className="detail__header">
        <div className="detail__poster">
          {movie.poster_url ? (
            <img src={movie.poster_url} alt={movie.title} />
          ) : (
            <div className="detail__poster-fallback">{movie.title}</div>
          )}
        </div>

        <div className="detail__info">
          <h1>{movie.title}</h1>
          <div className="detail__chips">
            {movie.genre && <span className="chip">{movie.genre}</span>}
            {movie.year ? <span className="chip">{movie.year}</span> : null}
          </div>
          <RatingBadge average={rating.average} total={rating.total_reviews} />

          {movie.director && (
            <p className="detail__line">
              <strong>Direção:</strong> {movie.director}
            </p>
          )}
          {movie.cast?.length > 0 && (
            <p className="detail__line">
              <strong>Elenco:</strong> {movie.cast.join(', ')}
            </p>
          )}
          {movie.synopsis && <p className="detail__synopsis">{movie.synopsis}</p>}
        </div>
      </div>

      <section className="reviews">
        <h2>Avaliações ({reviews.length})</h2>

        {reviews.length === 0 ? (
          <p className="reviews__empty">Ainda não há avaliações. Seja o primeiro!</p>
        ) : (
          <ul className="reviews__list">
            {reviews.map((r) => (
              <li key={r.id} className="review">
                <div className="review__head">
                  <span className="review__author">{r.author}</span>
                  <span className="review__rating">★ {r.rating.toFixed(1)}</span>
                </div>
                {r.comment && <p className="review__comment">{r.comment}</p>}
                {r.created_at && (
                  <time className="review__date">{formatDate(r.created_at)}</time>
                )}
              </li>
            ))}
          </ul>
        )}

        <AddReviewForm movieId={movie.id} onAdded={handleReviewAdded} />
      </section>
    </article>
  )
}

function formatDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
