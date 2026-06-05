import { Link } from 'react-router-dom'

// Card clicável de um filme. Mostra poster (ou placeholder gerado a partir do
// título quando poster_url está vazio), título, gênero, ano e diretor.
export default function MovieCard({ movie }) {
  const { id, title, genre, year, director, poster_url } = movie

  return (
    <Link to={`/movies/${id}`} className="movie-card">
      <div className="movie-card__poster">
        {poster_url ? (
          <img src={poster_url} alt={title} loading="lazy" />
        ) : (
          <PosterPlaceholder title={title} />
        )}
        {genre && <span className="movie-card__genre">{genre}</span>}
      </div>
      <div className="movie-card__body">
        <h3 className="movie-card__title">{title}</h3>
        <p className="movie-card__meta">
          {year ? <span>{year}</span> : null}
          {director ? <span>· {director}</span> : null}
        </p>
      </div>
    </Link>
  )
}

// Placeholder visual determinístico: gradiente baseado no hash do título.
function PosterPlaceholder({ title }) {
  const hue = hashHue(title)
  const style = {
    background: `linear-gradient(150deg, hsl(${hue} 55% 32%), hsl(${(hue + 40) % 360} 60% 18%))`,
  }
  const initials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="poster-placeholder" style={style}>
      <span>{initials}</span>
    </div>
  )
}

function hashHue(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360
  return h
}
