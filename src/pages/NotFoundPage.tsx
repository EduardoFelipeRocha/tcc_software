import { ArrowLeft, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="page not-found-page">
      <div className="container not-found-content">
        <span><Compass size={38} /></span>
        <p className="eyebrow">Erro 404</p>
        <h1>Esse caminho ainda não está no mapa.</h1>
        <p>Volte ao início ou explore as oportunidades disponíveis no protótipo.</p>
        <div>
          <Link className="button button-secondary" to="/"><ArrowLeft size={17} /> Ir para o início</Link>
          <Link className="button button-primary" to="/concursos">Explorar concursos</Link>
        </div>
      </div>
    </div>
  )
}
