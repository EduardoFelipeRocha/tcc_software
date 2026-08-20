import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Logo() {
  return (
    <Link className="brand" to="/" aria-label="GuiaConcursos — página inicial">
      <span className="brand-mark" aria-hidden="true">
        <Compass size={21} strokeWidth={2.4} />
      </span>
      <span>Guia<span className="brand-highlight">Concursos</span></span>
    </Link>
  )
}
