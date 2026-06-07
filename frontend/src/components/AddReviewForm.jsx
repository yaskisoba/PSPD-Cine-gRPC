import { useState } from 'react'
import { addReview } from '../api/client.js'

export default function AddReviewForm({ movieId, onSuccess, onClose }) {
  const [author, setAuthor] = useState('')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Per-field blur validation errors
  const [touched, setTouched] = useState({ author: false, comment: false, rating: false })

  const authorError = touched.author && author.trim().length < 2
    ? 'O nome precisa ter pelo menos 2 caracteres.'
    : null

  const commentError = touched.comment && comment.trim().length < 5
    ? 'O comentário precisa ter pelo menos 5 caracteres.'
    : null

  const ratingError = touched.rating && (rating < 0 || rating > 10)
    ? 'A nota deve estar entre 0 e 10.'
    : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setTouched({ author: true, comment: true, rating: true })
    setError(null)

    if (author.trim().length < 2) return
    if (comment.trim().length < 5) return
    if (rating < 0 || rating > 10) return

    setSubmitting(true)
    try {
      const review = await addReview(movieId, {
        author: author.trim(),
        rating,
        comment: comment.trim(),
      })
      setSuccess(true)
      setTimeout(() => {
        onSuccess?.(review)
      }, 800)
    } catch (err) {
      setError(err?.message || 'Não foi possível enviar a avaliação. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="review-form review-form--success">
        <p className="review-form__success-msg">✓ Avaliação enviada com sucesso!</p>
      </div>
    )
  }

  return (
    <form className="review-form" onSubmit={handleSubmit} noValidate>
      <h3>Deixe sua avaliação</h3>

      <label className="field">
        <span>Seu nome *</span>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, author: true }))}
          placeholder="Ex.: Maria Silva"
          maxLength={100}
        />
        {authorError && <span className="field__error">{authorError}</span>}
      </label>

      <div className="field">
        <span>Nota: <strong>{rating === 0 ? 'sem nota' : `${rating}/10`}</strong></span>
        <div className="star-row">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={`star-btn${rating === n ? ' star-btn--active' : ''}`}
              onClick={() => {
                setRating(rating === n ? 0 : n)
                setTouched((t) => ({ ...t, rating: true }))
              }}
              aria-label={`Nota ${n}`}
            >
              {n}
            </button>
          ))}
        </div>
        {ratingError && <span className="field__error">{ratingError}</span>}
      </div>

      <label className="field">
        <span>Comentário *</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, comment: true }))}
          placeholder="O que achou do filme?"
          rows={4}
          maxLength={500}
        />
        {commentError && <span className="field__error">{commentError}</span>}
      </label>

      {error && <p className="form-error">{error}</p>}

      <div className="review-form__actions">
        {onClose && (
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? (
            <><span className="spinner spinner--sm" /> Enviando…</>
          ) : (
            'Enviar avaliação'
          )}
        </button>
      </div>
    </form>
  )
}
