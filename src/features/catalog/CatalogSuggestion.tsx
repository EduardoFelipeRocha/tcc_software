import { CheckCircle2, Flag, Send, X } from 'lucide-react'
import { FormEvent, useEffect, useRef, useState } from 'react'

const ufs = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]

type SubmissionState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; protocol: string }
  | { status: 'error'; message: string }

export function CatalogSuggestion() {
  const [isOpen, setIsOpen] = useState(false)
  const [submission, setSubmission] = useState<SubmissionState>({ status: 'idle' })
  const submissionController = useRef<AbortController | null>(null)

  useEffect(() => () => submissionController.current?.abort(), [])

  const submitSuggestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmission({ status: 'submitting' })

    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const payload = Object.fromEntries(form.entries())
    submissionController.current?.abort()
    const controller = new AbortController()
    submissionController.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 12_000)

    try {
      const response = await fetch('/api/catalog/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      const contentType = response.headers.get('content-type') ?? ''
      const result = contentType.includes('application/json')
        ? await response.json() as { message?: string; protocol?: string }
        : {}
      if (!response.ok || !result.protocol) {
        throw new Error(result.message ?? 'Não foi possível enviar a indicação.')
      }

      if (submissionController.current !== controller) return
      setSubmission({ status: 'success', protocol: result.protocol })
      formElement.reset()
    } catch (error) {
      if (submissionController.current !== controller) return
      setSubmission({
        status: 'error',
        message: error instanceof DOMException && error.name === 'AbortError'
          ? 'O envio demorou demais. Tente novamente.'
          : error instanceof Error
            ? error.message
            : 'Não foi possível enviar a indicação.',
      })
    } finally {
      window.clearTimeout(timeout)
      if (submissionController.current === controller) submissionController.current = null
    }
  }

  return (
    <aside className="catalog-suggestion" aria-labelledby="catalog-suggestion-title">
      <div className="catalog-suggestion-heading">
        <span className="catalog-suggestion-icon"><Flag size={20} aria-hidden="true" /></span>
        <div>
          <h2 id="catalog-suggestion-title">Sentiu falta de algum concurso?</h2>
          <p>Envie o órgão e, se tiver, a fonte oficial. A indicação entra no radar sem virar informação confirmada automaticamente.</p>
        </div>
        <button
          className="button button-secondary"
          type="button"
          aria-expanded={isOpen}
          aria-controls="catalog-suggestion-form"
          onClick={() => {
            submissionController.current?.abort()
            submissionController.current = null
            setIsOpen((current) => !current)
            setSubmission({ status: 'idle' })
          }}
        >
          {isOpen ? <><X size={17} /> Fechar</> : 'Avisar concurso ausente'}
        </button>
      </div>

      {isOpen && (
        <form id="catalog-suggestion-form" className="catalog-suggestion-form" onSubmit={submitSuggestion}>
          <div className="catalog-suggestion-fields">
            <label>
              <span>Concurso ou cargo</span>
              <input name="contestName" required minLength={2} maxLength={160} placeholder="Ex.: Guarda Municipal" />
            </label>
            <label>
              <span>Órgão</span>
              <input name="organization" required minLength={2} maxLength={160} placeholder="Ex.: Prefeitura de Maricá" />
            </label>
            <label>
              <span>Município</span>
              <input name="municipality" maxLength={100} placeholder="Ex.: Maricá" />
            </label>
            <label>
              <span>UF</span>
              <select name="uf" required defaultValue="">
                <option value="" disabled>Selecione</option>
                {ufs.map((uf) => <option value={uf} key={uf}>{uf}</option>)}
              </select>
            </label>
            <label className="catalog-suggestion-wide">
              <span>Link oficial, se houver</span>
              <input name="officialUrl" type="url" maxLength={2_000} placeholder="https://prefeitura.gov.br/..." />
            </label>
            <label className="catalog-suggestion-wide">
              <span>O que você já sabe?</span>
              <textarea name="details" maxLength={1_000} rows={3} placeholder="Conte onde viu o anúncio, ato ou edital. Não inclua dados pessoais." />
            </label>
            <label className="catalog-suggestion-honeypot" aria-hidden="true">
              <span>Site</span>
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <div className="catalog-suggestion-actions">
            <small>A equipe confere a evidência e a etapa correta antes da publicação.</small>
            <button className="button button-primary" type="submit" disabled={submission.status === 'submitting'}>
              <Send size={17} /> {submission.status === 'submitting' ? 'Enviando…' : 'Enviar para o radar'}
            </button>
          </div>

          <div className="catalog-suggestion-feedback" aria-live="polite">
            {submission.status === 'success' && (
              <p className="catalog-suggestion-success"><CheckCircle2 size={18} /> Indicação recebida. Protocolo: <strong>{submission.protocol}</strong></p>
            )}
            {submission.status === 'error' && <p className="catalog-suggestion-error">{submission.message}</p>}
          </div>
        </form>
      )}
    </aside>
  )
}
