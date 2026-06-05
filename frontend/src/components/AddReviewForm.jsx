import { useState } from 'react'
import { addReview } from '../api/client.js'

// Formulário de nova avaliação. Valida autor (obrigatório) e nota (0–10),
// chama POST /movies/{id}/reviews (Unary AddReview no Módulo B) e notifica o pai.
export default function AddReviewForm({ movieId, onAdded }) {
  const [author, setAuthor] = useState('')
  const [rating, setRating] = useState('8')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const ratingNum = parseFloat(rating)
    if (!author.trim()) return setError('Informe o seu nome.')
    if (Number.isNaN(ratingNum) || ratingNum < 0 || ratingNum > 10)
      return setError('A nota deve ser um número entre 0 e 10.')

    setSubmitting(true)
    try {
      const review = await addReview(movieId, {
        author: author.trim(),
        rating: ratingNum,
        comment: comment.trim(),
      })
      setAuthor('')
      setRating('8')
      setComment('')
      onAdded?.(review)
    } catch (err) {
      setError(
        err?.response?.data?.detail || 'Não foi possível enviar a avaliação. Tente novamente.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="review-form" onSubmit={handleSubmit}>
      <h3>Deixe sua avaliação</h3>

      <div className="review-form__row">
        <label className="field">
          <span>Seu nome</span>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Ex.: Maria Silva"
            maxLength={60}
          />
        </label>

        <label className="field field--rating">
          <span>Nota (0–10)</span>
          <input
            type="number"
            min="0"
            max="10"
            step="0.5"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          />
        </label>
      </div>

      <label className="field">
        <span>Comentário (opcional)</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="O que achou do filme?"
          rows={3}
          maxLength={500}
        />
      </label>

      {error && <p className="form-error">{error}</p>}

      <button type="submit" className="btn btn--primary" disabled={submitting}>
        {submitting ? 'Enviando…' : 'Enviar avaliação'}
      </button>
    </form>
  )
}
