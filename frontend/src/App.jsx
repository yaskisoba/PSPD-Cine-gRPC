import { Routes, Route, Link } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import MovieDetailPage from './pages/MovieDetailPage.jsx'

export default function App() {
  return (
    <div className="app">
      <header className="navbar">
        <Link to="/" className="brand">
          <span className="brand-mark">🎬</span>
          <span className="brand-text">
            Cine<strong>GRPC</strong>
          </span>
        </Link>
        <span className="navbar-subtitle">Catálogo de Filmes • Microserviços gRPC</span>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/movies/:id" element={<MovieDetailPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer className="footer">
        CineGRPC — PSPD / UnB-FCTE · Frontend React consumindo o Gateway (P)
      </footer>
    </div>
  )
}

function NotFound() {
  return (
    <div className="state state--empty">
      <h2>404</h2>
      <p>Página não encontrada.</p>
      <Link to="/" className="btn btn--primary">Voltar ao catálogo</Link>
    </div>
  )
}
