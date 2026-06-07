import { useEffect, useMemo, useState } from 'react'
import { listMovies } from '../api/client.js'
import MovieCard from '../components/MovieCard.jsx'

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card__poster skeleton-pulse" />
      <div className="skeleton-card__body">
        <div className="skeleton-line skeleton-pulse" style={{ width: '80%', height: '1rem' }} />
        <div className="skeleton-line skeleton-pulse" style={{ width: '50%', height: '0.75rem', marginTop: '6px' }} />
      </div>
    </div>
  )
}

export default function HomePage() {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('')
  const [allGenres, setAllGenres] = useState([])

  const fetchMovies = (selectedGenre) => {
    setLoading(true)
    setError(null)
    return listMovies(selectedGenre)
  }

  useEffect(() => {
    let active = true
    fetchMovies(genre)
      .then((data) => {
        if (!active) return
        setMovies(data)
        // Populate genre list from the unfiltered fetch
        if (!genre) {
          setAllGenres([...new Set(data.map((m) => m.genre).filter(Boolean))].sort())
        }
      })
      .catch(() => active && setError('Não foi possível carregar os filmes. O Gateway está no ar?'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [genre])

  // When a genre filter is active, we still need the full genre list from an unfiltered fetch.
  useEffect(() => {
    if (!genre) return
    listMovies()
      .then((data) =>
        setAllGenres([...new Set(data.map((m) => m.genre).filter(Boolean))].sort()),
      )
      .catch(() => {})
  }, [])

  // Client-side text search over the already-fetched (possibly genre-filtered) list.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return movies
    return movies.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.director || '').toLowerCase().includes(q),
    )
  }, [movies, search])

  const retry = () => {
    setError(null)
    setLoading(true)
    listMovies(genre)
      .then((data) => setMovies(data))
      .catch(() => setError('Não foi possível carregar os filmes. O Gateway está no ar?'))
      .finally(() => setLoading(false))
  }

  return (
    <section>
      <div className="hero">
        <h1>Catálogo de Filmes</h1>
        <p>Navegue pelos filmes, veja notas e avaliações da comunidade.</p>
      </div>

      <div className="toolbar">
        <input
          className="toolbar__search"
          type="search"
          placeholder="🔎 Buscar por título ou diretor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="toolbar__select"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
        >
          <option value="">Todos os gêneros</option>
          {allGenres.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="movie-grid">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {error && !loading && (
        <div className="state state--error">
          <p>{error}</p>
          <button className="btn btn--primary" onClick={retry}>
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="state state--empty">
          {genre ? (
            <>
              <p>Nenhum filme neste gênero.</p>
              <button className="btn" onClick={() => setGenre('')}>
                Limpar filtro
              </button>
            </>
          ) : (
            <p>Nenhum filme encontrado. Adicione o primeiro!</p>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="movie-grid">
          {filtered.map((m) => <MovieCard key={m.id} movie={m} />)}
        </div>
      )}
    </section>
  )
}
