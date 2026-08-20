import { ArrowRight, Check, LogIn, ShieldCheck } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { studyRepository } from '../features/planner/studyRepository'
import { Logo } from '../shared/ui/Logo'
import { ThemeToggle } from '../shared/ui/ThemeToggle'

function safeReturnTo(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/meu-plano'
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login({ email, password })
      let syncFailed = false
      const guestPlan = studyRepository.loadGuest()
      if (guestPlan) {
        try {
          const accountLibrary = await studyRepository.loadAccount()
          const existing = accountLibrary.plans.find(
            (state) => state.plan.contestId === guestPlan.plan.contestId,
          )
          if (!existing) await studyRepository.importGuestToAccount()
        } catch {
          syncFailed = true
        }
      }
      navigate(syncFailed ? '/meu-plano?vinculo=pendente' : safeReturnTo(searchParams.get('returnTo')), { replace: true })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível entrar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <ThemeToggle className="auth-theme-toggle" />
      <section className="auth-aside login-aside">
        <Logo />
        <div>
          <p className="kicker light"><ShieldCheck size={15} /> Bem-vindo de volta</p>
          <h1>Seu plano, suas matérias e seu progresso no mesmo lugar.</h1>
          <ul>
            <li><Check /> Retome a próxima sessão recomendada</li>
            <li><Check /> Veja cada matéria do ciclo</li>
            <li><Check /> Acompanhe quanto da semana foi cumprido</li>
          </ul>
        </div>
        <small>GuiaConcursos · sua preparação com continuidade</small>
      </section>

      <main className="auth-main">
        <div className="auth-card">
          <span className="auth-card-icon"><LogIn size={23} /></span>
          <p className="eyebrow">Acessar sua área</p>
          <h2>Entre na sua conta</h2>
          <p className="auth-lead">Continue do ponto em que parou no seu plano de estudos.</p>

          <form className="auth-form" onSubmit={submit}>
            <label htmlFor="login-email">E-mail</label>
            <input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="voce@exemplo.com" />

            <label htmlFor="login-password">Senha</label>
            <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Sua senha" />

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="button button-accent button-large" type="submit" disabled={submitting}>
              {submitting ? 'Entrando…' : 'Entrar'} <ArrowRight size={18} />
            </button>
          </form>

          <p className="auth-switch">Ainda não possui conta? <Link to={`/cadastro?returnTo=${encodeURIComponent(safeReturnTo(searchParams.get('returnTo')))}`}>Criar conta</Link></p>
        </div>
      </main>
    </div>
  )
}
