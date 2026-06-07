import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getMovieDetail } from '../api/client.js'
import AddReviewForm from '../components/AddReviewForm.jsx'
import RatingBadge from '../components/RatingBadge.jsx'

const REVIEWS_VISIBLE = 10

export default function MovieDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showAllReviews, setShowAllReviews] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    setNotFound(false)
    getMovieDetail(id)
      .then(setData)
      .catch((err) => {
        // err.status is set by the response interceptor; fallback to response status
        if (err?.status === 404 || err?.response?.status === 404) {
          setNotFound(true)
        } else {
          setError('Erro ao carregar o filme. Verifique se o Gateway está no ar.')
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  // Optimistic update: insert the new review and recalculate average locally.
  const handleReviewAdded = (review) => {
    setData((prev) => {
      if (!prev) return prev
      const reviews = [...prev.reviews, review]
      const total = reviews.length
      const average = reviews.reduce((acc, r) => acc + (r.rating ?? 0), 0) / total
      return {
        ...prev,
        reviews,
        rating: { ...prev.rating, average, total_reviews: total },
      }
    })
    setShowModal(false)
  }

  if (loading)
    return (
      <div className="state">
        <div className="spinner" aria-label="Carregando…" />
      </div>
    )

  if (notFound)
    return (
      <div className="state state--empty">
        <h2>404</h2>
        <p>Filme não encontrado.</p>
        <Link to="/" className="btn btn--primary">← Voltar ao catálogo</Link>
      </div>
    )

  if (error)
    return (
      <div className="state state--error">
        <p>{error}</p>
        <Link to="/" className="btn">← Voltar</Link>
      </div>
    )

  const { movie, rating, reviews: rawReviews } = data

  // Sort newest first, then cap visible count
  const reviews = [...rawReviews].sort(
    (a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0),
  )
  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, REVIEWS_VISIBLE)
  const hasMore = reviews.length > REVIEWS_VISIBLE

  const hasRating = rating?.total_reviews > 0

  return (
    <article className="detail">
      <Link to="/" className="back-link">← Voltar ao catálogo</Link>

      <div className="detail__header">
        <div className="detail__poster">
          <PosterImage src={movie.poster_url} alt={movie.title} title={movie.title} />
        </div>

        <div className="detail__info">
          <h1>{movie.title}</h1>

          <div className="detail__chips">
            {movie.genre && <span className="chip">{movie.genre}</span>}
            {movie.year && <span className="chip">{movie.year}</span>}
            {movie.director && <span className="chip">Dir: {movie.director}</span>}
          </div>

          <div className="detail__rating-row">
            {hasRating ? (
              <>
                <span className="detail__rating-value">★ {Number(rating.average).toFixed(1)}</span>
                <span className="detail__rating-count">({rating.total_reviews} {rating.total_reviews === 1 ? 'avaliação' : 'avaliações'})</span>
              </>
            ) : (
              <span className="detail__rating-empty">Seja o primeiro a avaliar!</span>
            )}
          </div>

          {movie.director && (
            <p className="detail__line">
              <strong>Direção:</strong> {movie.director}
            </p>
          )}

          {movie.cast?.length > 0 && (
            <div className="detail__line">
              <strong>Elenco:</strong>
              {movie.cast.length > 4 ? (
                <div className="cast-scroll">
                  {movie.cast.map((name, i) => (
                    <span key={i} className="cast-chip">{name}</span>
                  ))}
                </div>
              ) : (
                <span> {movie.cast.join(', ')}</span>
              )}
            </div>
          )}

          {movie.synopsis && (
            <p className="detail__synopsis">{movie.synopsis}</p>
          )}
        </div>
      </div>

      <section className="reviews">
        <div className="reviews__header">
          <h2>Avaliações ({reviews.length})</h2>
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>
            + Adicionar avaliação
          </button>
        </div>

        {reviews.length === 0 ? (
          <p className="reviews__empty">Ainda não há avaliações. Seja o primeiro!</p>
        ) : (
          <>
            <ul className="reviews__list">
              {visibleReviews.map((r) => (
                <li key={r.id ?? r.created_at} className="review">
                  <div className="review__head">
                    <div className="review__author-row">
                      <span className="review__avatar" style={{ background: avatarColor(r.author) }}>
                        {(r.author ?? '?')[0].toUpperCase()}
                      </span>
                      <span className="review__author">{r.author}</span>
                    </div>
                    <span className="review__rating">★ {Number(r.rating ?? 0).toFixed(1)}/10</span>
                  </div>
                  {r.comment && <p className="review__comment">{r.comment}</p>}
                  {r.created_at && (
                    <time className="review__date">{formatDate(r.created_at)}</time>
                  )}
                </li>
              ))}
            </ul>
            {hasMore && !showAllReviews && (
              <button className="btn" onClick={() => setShowAllReviews(true)}>
                Mostrar todas as {reviews.length} avaliações
              </button>
            )}
          </>
        )}
      </section>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <button className="modal__close" aria-label="Fechar" onClick={() => setShowModal(false)}>✕</button>
            <AddReviewForm
              movieId={movie.id}
              onSuccess={handleReviewAdded}
              onClose={() => setShowModal(false)}
            />
          </div>
        </div>
      )}
    </article>
  )
}

function PosterImage({ src, alt, title }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        style={{ maxHeight: '480px', objectFit: 'cover', width: '100%', borderRadius: '12px' }}
        onError={() => setFailed(true)}
      />
    )
  }
  return <div className="detail__poster-fallback">{title}</div>
}

function avatarColor(name = '') {
  const colors = ['#e50914', '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#e91e63', '#00bcd4']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length
  return colors[Math.abs(h)]
}

function formatDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
