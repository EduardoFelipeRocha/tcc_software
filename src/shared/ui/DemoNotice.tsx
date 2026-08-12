import { FlaskConical, X } from 'lucide-react'
import { useState } from 'react'

export function DemoNotice() {
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  return (
    <aside className="demo-notice" aria-label="Aviso sobre os dados">
      <div className="container demo-notice-inner">
        <FlaskConical size={17} aria-hidden="true" />
        <p>
          <strong>Protótipo em construção.</strong> Os concursos exibidos são cenários de interface,
          não informações atuais para inscrição.
        </p>
        <button
          className="icon-button notice-close"
          type="button"
          aria-label="Fechar aviso"
          onClick={() => setVisible(false)}
        >
          <X size={17} />
        </button>
      </div>
    </aside>
  )
}
