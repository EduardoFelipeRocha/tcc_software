import {
  ArrowRight,
  CalendarDays,
  Check,
  Circle,
  Clock3,
  ExternalLink,
  RefreshCw,
  Route,
  Sparkles,
  Target,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  loadCompletedSessions,
  loadPlan,
  saveCompletedSessions,
} from '../features/planner/storage'

export function MyPlanPage() {
  const [searchParams] = useSearchParams()
  const [plan] = useState(loadPlan)
  const [completed, setCompleted] = useState(loadCompletedSessions)

  const groupedSessions = useMemo(() => {
    if (!plan) return []
    return plan.weekdays.map((weekday) => ({
      weekday,
      sessions: plan.sessions.filter((session) => session.weekday === weekday),
    })).filter((group) => group.sessions.length > 0)
  }, [plan])

  if (!plan) {
    return (
      <div className="page plan-empty-page">
        <div className="container empty-plan">
          <span className="empty-plan-icon"><Route size={34} /></span>
          <p className="kicker">Seu espaço de estudo</p>
          <h1>Seu plano começa com três escolhas simples.</h1>
          <p>Escolha um objetivo, informe sua disponibilidade e conte como está seu conhecimento atual.</p>
          <Link className="button button-accent button-large" to="/planejamento/novo">
            Criar meu primeiro plano <ArrowRight size={19} />
          </Link>
        </div>
      </div>
    )
  }

  const toggleSession = (sessionId: string) => {
    const next = completed.includes(sessionId)
      ? completed.filter((id) => id !== sessionId)
      : [...completed, sessionId]
    setCompleted(next)
    saveCompletedSessions(next)
  }

  const progress = Math.round((completed.length / plan.sessions.length) * 100)
  const studiedMinutes = plan.sessions
    .filter((session) => completed.includes(session.id))
    .reduce((total, session) => total + session.minutes, 0)

  return (
    <div className="page dashboard-page">
      <section className="dashboard-hero">
        <div className="container dashboard-hero-grid">
          <div>
            {searchParams.get('novo') === '1' && <p className="success-message"><Sparkles size={16} /> Seu plano foi criado.</p>}
            <p className="eyebrow light">Plano semanal · algoritmo {plan.algorithmVersion}</p>
            <h1>{plan.contestTitle}</h1>
            <p>{plan.organization} · baseado em {plan.referenceLabel.toLocaleLowerCase('pt-BR')}</p>
          </div>
          <div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{progress}%</strong><span>da semana</span></div>
          </div>
        </div>
      </section>

      <div className="container dashboard-layout">
        <main>
          <div className="dashboard-heading">
            <div><p className="kicker">Sua semana</p><h2>Constância antes de intensidade.</h2></div>
            <Link className="button button-secondary" to={`/planejamento/novo?concurso=${plan.contestSlug}`}>
              <RefreshCw size={16} /> Recalcular plano
            </Link>
          </div>

          <div className="schedule-list">
            {groupedSessions.map((group) => (
              <section className="schedule-day" key={group.weekday}>
                <div className="schedule-day-label"><strong>{group.weekday}</strong><span>{group.sessions.length} {group.sessions.length === 1 ? 'sessão' : 'sessões'}</span></div>
                <div className="schedule-day-sessions">
                  {group.sessions.map((session) => {
                    const isCompleted = completed.includes(session.id)
                    return (
                      <button
                        className={`plan-session${isCompleted ? ' completed' : ''}`}
                        type="button"
                        key={session.id}
                        aria-pressed={isCompleted}
                        onClick={() => toggleSession(session.id)}
                      >
                        <span className="completion-control">{isCompleted ? <Check size={17} /> : <Circle size={17} />}</span>
                        <span className="session-main"><strong>{session.subjectName}</strong><small>{session.kind}</small></span>
                        <span className="session-time"><Clock3 size={14} /> {session.minutes} min</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </main>

        <aside className="dashboard-sidebar">
          <div className="summary-card">
            <p className="eyebrow">Resumo da semana</p>
            <div className="summary-stat"><span><Clock3 size={18} /> Tempo concluído</span><strong>{Math.floor(studiedMinutes / 60)}h {studiedMinutes % 60}min</strong></div>
            <div className="summary-stat"><span><Target size={18} /> Sessões</span><strong>{completed.length} de {plan.sessions.length}</strong></div>
            <div className="summary-stat"><span><CalendarDays size={18} /> Disponibilidade</span><strong>{plan.hoursPerWeek}h/semana</strong></div>
          </div>
          <div className="explanation-card">
            <p className="eyebrow">Por que este plano?</p>
            <h2>Prioridade com justificativa.</h2>
            <p>O cálculo combina o peso demonstrativo da matéria com a lacuna informada por você.</p>
            <Link className="text-link" to="/metodologia">Ver cálculo <ExternalLink size={14} /></Link>
          </div>
          <div className="local-data-note">
            <span><Check size={16} /></span>
            <p><strong>Privacidade no protótipo</strong>Seu plano está guardado apenas neste navegador.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
