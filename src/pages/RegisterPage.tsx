import { ArrowRight, Check, LockKeyhole, ShieldCheck, UserPlus } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { studyRepository } from '../features/planner/studyRepository'
import { Logo } from '../shared/ui/Logo'
import { ThemeToggle } from '../shared/ui/ThemeToggle'

function safeReturnTo(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/meu-plano'
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (password !== confirmation) {
      setError('As senhas não coincidem.')
      return
    }
    setSubmitting(true)
    try {
      await register({ name, email, password })
      let syncFailed = false
      try {
        await studyRepository.importGuestToAccount()
      } catch {
        syncFailed = true
      }
      navigate(syncFailed ? '/meu-plano?vinculo=pendente' : safeReturnTo(searchParams.get('returnTo')), { replace: true })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível criar sua conta.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <ThemeToggle className="auth-theme-toggle" />
      <section className="auth-aside">
        <Logo />
        <div>
          <p className="kicker light"><ShieldCheck size={15} /> Sua preparação continua</p>
          <h1>Estude hoje. Continue exatamente de onde parou amanhã.</h1>
          <p>Uma conta guarda seu plano e as sessões concluídas no servidor deste projeto.</p>
          <ul>
            <li><Check /> Plano vinculado ao seu usuário</li>
            <li><Check /> Progresso atualizado a cada sessão</li>
            <li><Check /> Senha protegida por hash; nunca salva em texto</li>
          </ul>
        </div>
        <small>GuiaConcursos · preparação baseada em documentos oficiais</small>
      </section>

      <main className="auth-main">
        <div className="auth-card">
          <span className="auth-card-icon"><UserPlus size={23} /></span>
          <p className="eyebrow">Comece gratuitamente</p>
          <h2>Crie sua conta</h2>
          <p className="auth-lead">Leva menos de um minuto e mantém seu plano protegido por login.</p>

          {searchParams.get('plano') === '1' && (
            <div className="pending-plan-notice"><Check size={16} /> Seu plano já foi montado e será vinculado à nova conta.</div>
          )}

          <form className="auth-form" onSubmit={submit}>
            <label htmlFor="register-name">Nome</label>
            <input id="register-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} placeholder="Como podemos chamar você?" />

            <label htmlFor="register-email">E-mail</label>
            <input id="register-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="voce@exemplo.com" />

            <label htmlFor="register-password">Senha</label>
            <input id="register-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} placeholder="No mínimo 8 caracteres" />

            <label htmlFor="register-confirmation">Confirmar senha</label>
            <input id="register-confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} placeholder="Digite a senha novamente" />

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="button button-accent button-large" type="submit" disabled={submitting}>
              {submitting ? 'Criando conta…' : 'Criar conta'} <ArrowRight size={18} />
            </button>
          </form>

          <p className="auth-switch">Já tem uma conta? <Link to={`/entrar?returnTo=${encodeURIComponent(safeReturnTo(searchParams.get('returnTo')))}`}>Entrar</Link></p>
          <p className="auth-security"><LockKeyhole size={14} /> Sessão protegida por cookie HTTP-only. Não reutilize uma senha importante neste projeto acadêmico.</p>
        </div>
      </main>
    </div>
  )
}
