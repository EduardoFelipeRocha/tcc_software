import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  ChevronDown,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  CloudCheck,
  ExternalLink,
  LogIn,
  RefreshCw,
  Route,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import {
  findStudyState,
  studyRepository,
  type StudyLibrary,
  type StudyState,
} from '../features/planner/studyRepository'

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error'

function normalizeStudyState(state: StudyState | null) {
  if (!state) return null
  const validSessionIds = new Set(state.plan.sessions.map((session) => session.id))
  return {
    ...state,
    completedSessionIds: state.completedSessionIds.filter((id) => validSessionIds.has(id)),
  }
}

export function MyPlanPage() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const [guestStudyState, setGuestStudyState] = useState<StudyState | null>(() =>
    normalizeStudyState(studyRepository.loadGuest()),
  )
  const [accountLibrary, setAccountLibrary] = useState<StudyLibrary | null>(null)
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [resolvingGuestPlan, setResolvingGuestPlan] = useState(false)
  const [openSubject, setOpenSubject] = useState<{ planId: string; subjectId: string } | null>(null)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const saveVersion = useRef(0)
  const saveAbortController = useRef(new AbortController())
  const pageIsActive = useRef(true)

  useEffect(() => {
    pageIsActive.current = true
    return () => {
      pageIsActive.current = false
      saveAbortController.current.abort()
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return

    let active = true
    void studyRepository
      .loadAccount()
      .then((library) => {
        if (!active) return
        setAccountLibrary(library)
        setLoadError('')
        setLoadedUserId(user.id)
      })
      .catch((error: unknown) => {
        if (!active) return
        setAccountLibrary(null)
        setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar seu plano.')
        setLoadedUserId(user.id)
      })

    return () => {
      active = false
    }
  }, [authLoading, user])

  const accountIsLoading = Boolean(user && loadedUserId !== user.id)
  const requestedPlanId = searchParams.get('plano')
  const accountStudyState = user && accountLibrary
    ? normalizeStudyState(findStudyState(accountLibrary, requestedPlanId))
    : null
  const studyState = user && accountLibrary
    ? requestedPlanId ? accountStudyState : accountStudyState ?? guestStudyState
    : guestStudyState
  const plan = studyState?.plan ?? null
  const completed = studyState?.completedSessionIds ?? []
  const hasAccountPlans = Boolean(accountLibrary?.plans.length)
  const guestMatchesAccountPlan = Boolean(
    guestStudyState && accountLibrary?.plans.some(
      (state) => state.plan.contestId === guestStudyState.plan.contestId,
    ),
  )
  const requestedPlanMissing = Boolean(
    user && accountLibrary && requestedPlanId && !accountStudyState,
  )

  const groupedSessions = useMemo(() => {
    if (!plan) return []
    return plan.weekdays
      .map((weekday) => ({
        weekday,
        sessions: plan.sessions.filter((session) => session.weekday === weekday),
      }))
      .filter((group) => group.sessions.length > 0)
  }, [plan])

  if (authLoading || accountIsLoading) {
    return (
      <div className="page plan-loading-page" role="status">
        <span className="loading-spinner" />
        <p>Carregando seu plano e progresso…</p>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="page plan-empty-page">
        <div className="container empty-plan">
          <span className="empty-plan-icon"><Route size={34} /></span>
          <p className="kicker">Seu espaço de estudo</p>
          <h1>{loadError
            ? 'Não conseguimos abrir seu plano agora.'
            : requestedPlanMissing
              ? 'Esse plano não está mais disponível.'
              : 'Seu plano começa com três escolhas simples.'}</h1>
          <p>{loadError || (requestedPlanMissing
            ? 'Ele pode ter sido excluído em outra tela. Seus demais planos continuam intactos.'
            : 'Escolha um objetivo, informe sua disponibilidade e conte como está seu conhecimento atual.')}</p>
          <div className="empty-plan-actions">
            {requestedPlanMissing && hasAccountPlans ? (
              <Link className="button button-accent button-large" to="/conta">
                Ver meus planos <ArrowRight size={19} />
              </Link>
            ) : (
              <Link className="button button-accent button-large" to="/planejamento/novo">
                Criar meu primeiro plano <ArrowRight size={19} />
              </Link>
            )}
            {!user && (
              <Link className="button button-secondary button-large" to="/entrar?returnTo=/meu-plano">
                <LogIn size={18} /> Entrar na minha conta
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  const usingGuestFallback = Boolean(
    user && !accountStudyState && guestStudyState?.plan.contestId === plan.contestId,
  )

  const persistProgress = (nextCompleted: string[]) => {
    const version = ++saveVersion.current
    setSyncStatus('saving')
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        if (!pageIsActive.current) return
        if (user) {
          if (saveAbortController.current.signal.aborted) {
            saveAbortController.current = new AbortController()
          }
          const savedLibrary = await studyRepository.saveAccount(
            plan,
            nextCompleted,
            saveAbortController.current.signal,
          )
          if (pageIsActive.current && version === saveVersion.current) {
            setAccountLibrary(savedLibrary)
            if (usingGuestFallback) {
              studyRepository.clearGuest()
              setGuestStudyState(null)
            }
          }
        } else studyRepository.saveGuest(plan, nextCompleted)
      })
      .then(() => {
        if (pageIsActive.current && version === saveVersion.current) setSyncStatus('saved')
      })
      .catch(() => {
        if (pageIsActive.current && version === saveVersion.current) setSyncStatus('error')
      })
  }

  const toggleSession = (sessionId: string) => {
    const nextCompleted = completed.includes(sessionId)
      ? completed.filter((id) => id !== sessionId)
      : [...completed, sessionId]
    const nextStudyState: StudyState = {
      plan,
      completedSessionIds: nextCompleted,
      updatedAt: new Date().toISOString(),
    }
    if (user) {
      setAccountLibrary((current) => current ? {
        ...current,
        activePlanId: plan.contestId,
        plans: current.plans.some((state) => state.plan.contestId === plan.contestId)
          ? current.plans.map((state) =>
            state.plan.contestId === plan.contestId ? nextStudyState : state)
          : [nextStudyState, ...current.plans],
        updatedAt: nextStudyState.updatedAt,
      } : current)
      if (usingGuestFallback) {
        setGuestStudyState(nextStudyState)
        studyRepository.saveGuest(plan, nextCompleted)
      }
    } else setGuestStudyState(nextStudyState)
    persistProgress(nextCompleted)
  }

  const replaceAccountWithGuestPlan = async () => {
    if (!guestStudyState) return
    setResolvingGuestPlan(true)
    setSyncStatus('saving')
    try {
      const savedLibrary = await studyRepository.saveAccount(
        guestStudyState.plan,
        guestStudyState.completedSessionIds,
      )
      studyRepository.clearGuest()
      setAccountLibrary(savedLibrary)
      setGuestStudyState(null)
      setSyncStatus('saved')
    } catch {
      setSyncStatus('error')
    } finally {
      setResolvingGuestPlan(false)
    }
  }

  const keepAccountPlan = () => {
    studyRepository.clearGuest()
    setGuestStudyState(null)
  }

  const progress = plan.sessions.length
    ? Math.round((completed.length / plan.sessions.length) * 100)
    : 0
  const planCompleted = plan.sessions.length > 0 && completed.length === plan.sessions.length
  const studiedMinutes = plan.sessions
    .filter((session) => completed.includes(session.id))
    .reduce((total, session) => total + session.minutes, 0)
  const hasVerifiedReference = plan.referenceType !== 'legacy_unverified' && Boolean(plan.referenceUrl)
  const referenceIsHistorical = plan.referenceType === 'previous_notice'
  const previousEditionIsOlder = Boolean(
    plan.previousEditionUrl && plan.previousEditionYear && plan.referenceYear &&
    plan.previousEditionYear < plan.referenceYear,
  )
  const hasEditionSupportMaterial = Boolean(
    plan.previousEditionUrl && plan.previousEditionUrl !== plan.referenceUrl &&
    (referenceIsHistorical || previousEditionIsOlder),
  )

  return (
    <div className="page dashboard-page">
      <section className="dashboard-hero">
        <div className="container dashboard-hero-grid">
          <div>
            {searchParams.get('novo') === '1' && <p className="success-message"><Sparkles size={16} /> Seu plano foi criado e vinculado à sua conta.</p>}
            <p className="eyebrow light">Plano semanal · algoritmo {plan.algorithmVersion}</p>
            <h1>{plan.contestTitle}</h1>
            <p>{plan.organization} · referência: {plan.referenceLabel}</p>
            <small className="plan-reference-note">{plan.referenceNote}</small>
            {hasVerifiedReference && (
              <a className="plan-reference-link" href={plan.referenceUrl} target="_blank" rel="noreferrer">
                Abrir edital usado neste plano <ExternalLink size={15} />
              </a>
            )}
            {hasEditionSupportMaterial && (
              <a className="plan-reference-link plan-reference-secondary" href={plan.previousEditionUrl} target="_blank" rel="noreferrer">
                {previousEditionIsOlder
                  ? 'Abrir edital/prova da edição anterior'
                  : 'Abrir provas e materiais da edição'} <ExternalLink size={15} />
              </a>
            )}
            {hasVerifiedReference && !referenceIsHistorical && !previousEditionIsOlder && (
              <span className="plan-no-previous">Edital anterior oficial: não vinculado para este cargo.</span>
            )}
          </div>
          <div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{progress}%</strong><span>da semana</span></div>
          </div>
        </div>
      </section>

      {!hasVerifiedReference && (
        <div className="legacy-plan-warning">
          <div className="container">
            <ShieldAlert size={21} />
            <p><strong>Este plano veio de uma versão anterior e não tem base documental validada.</strong><span>Seu progresso foi preservado, mas as matérias podem ser genéricas. Recrie o plano escolhendo um cargo com edital conferido.</span></p>
            <Link className="button button-accent" to={`/planejamento/novo?concurso=${plan.contestSlug}`}>Recriar com base oficial</Link>
          </div>
        </div>
      )}

      {!user && (
        <div className="guest-plan-banner">
          <div className="container">
            <div><CloudCheck size={21} /><p><strong>Seu plano ainda está como convidado.</strong><span>Crie uma conta para vinculá-lo ao seu usuário e recuperar o progresso ao entrar novamente.</span></p></div>
            <Link className="button button-accent" to="/cadastro?plano=1&returnTo=%2Fmeu-plano">Criar conta</Link>
          </div>
        </div>
      )}

      {user && guestStudyState && (
        <div className="plan-conflict-banner">
          <div className="container">
            <div>
              <CloudCheck size={21} />
              <p>
                <strong>{hasAccountPlans ? 'Encontramos outro plano neste dispositivo.' : 'Seu plano deste dispositivo ainda precisa ser vinculado.'}</strong>
                <span>{guestMatchesAccountPlan
                  ? 'É outra versão do mesmo concurso. Escolha qual versão deseja manter.'
                  : hasAccountPlans
                    ? 'Você pode adicioná-lo à conta sem remover os outros planos.'
                    : 'O cadastro está ativo e o plano foi preservado; tente vinculá-lo novamente.'}</span>
              </p>
            </div>
            <div className="plan-conflict-actions">
              {hasAccountPlans && <button className="button button-secondary" type="button" onClick={keepAccountPlan} disabled={resolvingGuestPlan}>{guestMatchesAccountPlan ? 'Manter versão da conta' : 'Descartar plano local'}</button>}
              <button className="button button-accent" type="button" onClick={replaceAccountWithGuestPlan} disabled={resolvingGuestPlan}>{resolvingGuestPlan ? 'Salvando…' : guestMatchesAccountPlan ? 'Usar versão deste dispositivo' : 'Adicionar à minha conta'}</button>
            </div>
          </div>
        </div>
      )}

      {planCompleted && (
        <div className="plan-completed-banner">
          <div className="container">
            <CheckCircle2 size={25} />
            <p><strong>Você concluiu todas as sessões deste plano.</strong><span>Ele continuará salvo. Você pode abrir as matérias, revisar os tópicos e refazer qualquer sessão quando quiser.</span></p>
            <a className="button button-completed" href="#weekly-schedule-title">Revisar sessões</a>
          </div>
        </div>
      )}

      <div className="container dashboard-layout">
        <main>
          <section className="plan-subjects-section" aria-labelledby="plan-subjects-title">
            <div className="dashboard-heading">
              <div><p className="kicker"><BookOpenCheck size={15} /> Conteúdo do plano</p><h2 id="plan-subjects-title">Matérias e tópicos que você vai estudar</h2></div>
              <Link className="button button-secondary" to={`/planejamento/novo?concurso=${plan.contestSlug}`}>
                <RefreshCw size={16} /> Recalcular plano
              </Link>
            </div>
            <p className="subject-interaction-hint">Clique em uma matéria para abrir todos os tópicos do edital.</p>
            {plan.subjects.some((subject) =>
              subject.topics.some((topic) => topic.toLocaleLowerCase('pt-BR').includes('treino sugerido')),
            ) && (
              <p className="subject-detail-note">
                <BookOpenCheck size={17} /> Quando o edital usa um rótulo amplo sem listar subtópicos, o roteiro identifica claramente as habilidades de treino sugeridas. Elas ajudam a estudar o item sem fingir que são uma lista oficial adicional.
              </p>
            )}
            {plan.subjects.some((subject) => subject.sessionCount === 0) && (
              <p className="subject-coverage-warning"><ShieldAlert size={16} /> Sua carga desta semana não comporta uma sessão para todas as matérias. Os cartões continuam mostrando o conteúdo oficial completo; aumente as horas ao recalcular para incluir as matérias marcadas com zero sessão.</p>
            )}
            <div className="plan-subject-grid">
              {plan.subjects.map((subject) => {
                const isOpen = openSubject?.planId === plan.contestId && openSubject.subjectId === subject.id
                return (
                <details className="plan-subject-card" key={subject.id} open={isOpen}>
                  <summary
                    aria-expanded={isOpen}
                    onClick={(event) => {
                      event.preventDefault()
                      setOpenSubject(isOpen ? null : { planId: plan.contestId, subjectId: subject.id })
                    }}
                  >
                    <div className="plan-subject-heading">
                      <span>{subject.name.slice(0, 2).toLocaleUpperCase('pt-BR')}</span>
                      <div><h3>{subject.name}</h3><p>{subject.sessionCount} {subject.sessionCount === 1 ? 'sessão' : 'sessões'} · {subject.totalMinutes} min</p></div>
                    </div>
                    <ChevronDown className="subject-chevron" size={20} />
                    <div className="subject-priority-row"><span>{plan.weightingBasis === 'official_distribution' ? 'Distribuição oficial' : 'Base equilibrada do plano'}</span><strong>{Number(subject.priority.toFixed(2))}%</strong></div>
                    <div className="subject-priority-track"><span style={{ width: `${Math.min(100, subject.priority)}%` }} /></div>
                    <span className="subject-open-label">{isOpen ? 'Ocultar conteúdo' : 'Ver conteúdo completo'}</span>
                  </summary>
                  <div className="subject-topic-panel">
                    <div className="subject-topic-heading">
                      <p>Roteiro detalhado desta matéria</p>
                      <span>{subject.topics.length} {subject.topics.length === 1 ? 'ponto' : 'pontos'} para estudar</span>
                    </div>
                    <ol>
                      {subject.topics.map((topic, index) => (
                        <li key={`${subject.id}-${index}`}>
                          <span className="topic-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                          <span>{topic}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </details>
                )
              })}
            </div>
          </section>

          <section className="weekly-schedule" aria-labelledby="weekly-schedule-title">
            <div className="dashboard-heading schedule-heading">
              <div><p className="kicker">Sua semana</p><h2 id="weekly-schedule-title">Marque cada sessão ao concluir</h2></div>
              <p className={`sync-status sync-${syncStatus}`} aria-live="polite">
                {syncStatus === 'saving' && 'Salvando progresso…'}
                {syncStatus === 'saved' && <><Check size={14} /> Progresso salvo</>}
                {syncStatus === 'error' && 'Falha ao salvar. Tente marcar novamente.'}
              </p>
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
                          <span className="session-main"><strong>{session.subjectName}</strong><small>{session.kind} · {session.topic}</small></span>
                          <span className="session-time"><Clock3 size={14} /> {session.minutes} min</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>
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
            <p>{hasVerifiedReference
              ? <>O cálculo combina o conteúdo do documento oficial indicado no topo com a lacuna informada por você. {plan.weightingBasis === 'balanced_syllabus' && 'Como a referência não define peso por matéria, o ponto de partida é equilibrado.'}</>
              : 'Este plano legado foi preservado apenas para não apagar seu histórico. Recrie-o para receber matérias e prioridades validadas.'}</p>
            <Link className="text-link" to="/metodologia">Ver cálculo <ExternalLink size={14} /></Link>
          </div>
          <div className="local-data-note">
            <span><Check size={16} /></span>
            {user ? (
              <p><strong>Vinculado à sua conta</strong>Seu plano e progresso ficam no servidor do projeto e voltam quando você entra novamente.</p>
            ) : (
              <p><strong>Salvo como convidado</strong>Este plano fica somente neste navegador até você criar uma conta.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
