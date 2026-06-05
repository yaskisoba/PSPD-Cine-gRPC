import axios from 'axios'

// Base URL do Gateway (P). Definida em build-time pelo Vite via VITE_API_URL.
// Fallback para localhost:8000 (dev sem .env).
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Movies (Módulo A, via Gateway) ───────────────────────────────────────────

// GET /movies?genre=  → Server Streaming (ListMovies) agregado em lista JSON
export const listMovies = (genre) =>
  api.get('/movies', { params: genre ? { genre } : {} }).then((r) => r.data)

// GET /movies/{id}  → Unary (GetMovie) + Unary (GetMovieRating) + Server Stream (GetMovieReviews)
// Retorna { movie, rating, reviews }
export const getMovie = (id) => api.get(`/movies/${id}`).then((r) => r.data)

// POST /movies  → Unary (CreateMovie)
export const createMovie = (body) => api.post('/movies', body).then((r) => r.data)

// ── Reviews (Módulo B, via Gateway) ──────────────────────────────────────────

// POST /movies/{id}/reviews  → Unary (AddReview)
export const addReview = (movieId, body) =>
  api.post(`/movies/${movieId}/reviews`, body).then((r) => r.data)

// GET /movies/{id}/rating  → Unary (GetMovieRating)
export const getRating = (movieId) =>
  api.get(`/movies/${movieId}/rating`).then((r) => r.data)

// ── Infra ────────────────────────────────────────────────────────────────────

export const getHealth = () => api.get('/health').then((r) => r.data)

export const API_BASE_URL = baseURL

export default api
