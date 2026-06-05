import { useEffect, useMemo, useState } from 'react'
import { listMovies } from '../api/client.js'
import MovieCard from '../components/MovieCard.jsx'

export default function HomePage() {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    // O filtro de gênero é aplicado no backend (Módulo A, via ?genre=).
    listMovies(genre)
      .then((data) => active && setMovies(data))
      .catch(() => active && setError('Não foi possível carregar os filmes. O Gateway (P) está no ar?'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [genre])

  // Lista de gêneros para o seletor: derivada dos filmes carregados (sem filtro de gênero).
  const [allGenres, setAllGenres] = useState([])
  useEffect(() => {
    listMovies()
      .then((data) => setAllGenres([...new Set(data.map((m) => m.genre).filter(Boolean))].sort()))
      .catch(() => {})
  }, [])

  // A busca por texto (título/diretor) é feita no cliente sobre o resultado já filtrado.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return movies
    return movies.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.director || '').toLowerCase().includes(q),
    )
  }, [movies, search])

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
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="state">Carregando filmes…</div>}

      {error && !loading && (
        <div className="state state--error">{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="state state--empty">Nenhum filme encontrado.</div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="movie-grid">
          {filtered.map((m) => (
            <MovieCard key={m.id} movie={m} />
          ))}
        </div>
      )}
    </section>
  )
}
