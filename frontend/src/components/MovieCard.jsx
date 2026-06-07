import { useState } from 'react'
import { Link } from 'react-router-dom'

const genreColorMap = {
  'Ação': '#e50914',
  'Action': '#e50914',
  'Aventura': '#e67e22',
  'Adventure': '#e67e22',
  'Comédia': '#f1c40f',
  'Comedy': '#f1c40f',
  'Drama': '#3498db',
  'Ficção Científica': '#9b59b6',
  'Sci-Fi': '#9b59b6',
  'Science Fiction': '#9b59b6',
  'Terror': '#1abc9c',
  'Horror': '#1abc9c',
  'Romance': '#e91e63',
  'Animação': '#00bcd4',
  'Animation': '#00bcd4',
  'Documentário': '#795548',
  'Documentary': '#795548',
  'Suspense': '#607d8b',
  'Thriller': '#607d8b',
}

function genreBadgeStyle(genre) {
  const color = genreColorMap[genre]
  if (color) return { background: color + 'cc', color: '#fff' }
  return { background: 'rgba(0,0,0,0.65)', color: '#fff' }
}

export default function MovieCard({ movie }) {
  const { id, title, genre, year, director, poster_url, rating } = movie
  const [imgFailed, setImgFailed] = useState(false)

  const showPlaceholder = !poster_url || imgFailed

  const avg = rating?.average ?? rating?.avg ?? null
  const hasRating = avg !== null && avg !== undefined

  return (
    <Link to={`/movies/${id}`} className="movie-card">
      <div className="movie-card__poster">
        {!showPlaceholder ? (
          <img
            src={poster_url}
            alt={title}
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <PosterPlaceholder title={title} />
        )}
        {genre && (
          <span className="movie-card__genre" style={genreBadgeStyle(genre)}>
            {genre}
          </span>
        )}
      </div>
      <div className="movie-card__body">
        <h3 className="movie-card__title">{title}</h3>
        <p className="movie-card__meta">
          {year ? <span>{year}</span> : null}
          {director ? <span>· {director}</span> : null}
        </p>
      </div>
      <div className="movie-card__footer">
        <span className="movie-card__rating">
          {hasRating ? `★ ${Number(avg).toFixed(1)}` : 'Sem nota ainda'}
        </span>
      </div>
    </Link>
  )
}

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
