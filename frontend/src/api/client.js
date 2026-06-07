import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (import.meta.env.DEV) {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`)
  }
  return config
})

// Extract FastAPI `detail` field and re-throw as a standard Error.
// Preserve `status` so callers can still branch on HTTP status codes.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const detail = err?.response?.data?.detail
    const status = err?.response?.status
    if (detail) {
      const error = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
      error.status = status
      return Promise.reject(error)
    }
    return Promise.reject(err)
  },
)

// ── Movies ───────────────────────────────────────────────────────────────────

// GET /movies?genre=<optional>
export const listMovies = (genre) =>
  api.get('/movies', { params: genre ? { genre } : {} }).then((r) => r.data)

// GET /movies/:id — returns { movie, rating, reviews }
export const getMovieDetail = (id) => api.get(`/movies/${id}`).then((r) => r.data)

// Backward-compat alias
export const getMovie = getMovieDetail

// POST /movies
export const createMovie = (data) => api.post('/movies', data).then((r) => r.data)

// POST /movies/:id/reviews
export const addReview = (movieId, data) =>
  api.post(`/movies/${movieId}/reviews`, data).then((r) => r.data)

// POST /movies/bulk-import
export const bulkImportMovies = (movies) =>
  api.post('/movies/bulk-import', movies).then((r) => r.data)

// GET /movies/:id/rating
export const getRating = (movieId) =>
  api.get(`/movies/${movieId}/rating`).then((r) => r.data)

// GET /health
export const checkHealth = () => api.get('/health').then((r) => r.data)
export const getHealth = checkHealth

export const API_BASE_URL = baseURL

export default api
