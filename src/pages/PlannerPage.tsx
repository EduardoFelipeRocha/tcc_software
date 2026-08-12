import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Gauge,
  Info,
  Sparkles,
} from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { contestRepository } from '../data/repositories/contestRepository'
import type { Contest } from '../entities/contest/types'
import { generatePlan } from '../features/planner/generatePlan'
import { savePlan } from '../features/planner/storage'
import { PhaseBadge } from '../shared/ui/StatusBadge'

const weekdays = [
  { short: 'SEG', label: 'Segunda' },
  { short: 'TER', label: 'Terça' },
  { short: 'QUA', label: 'Quarta' },
  { short: 'QUI', label: 'Quinta' },
  { short: 'SEX', label: 'Sexta' },
  { short: 'SÁB', label: 'Sábado' },
  { short: 'DOM', label: 'Domingo' },
]

const knowledgeLabels = ['Nunca estudei', 'Começando', 'Básico', 'Intermediário', 'Bom', 'Domino bem']

export function PlannerPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedSlug = searchParams.get('concurso')
  const [contests, setContests] = useState<Contest[]>([])
  const [contestId, setContestId] = useState('')
  const [hours, setHours] = useState(8)
  const [selectedDays, setSelectedDays] = useState(['SEG', 'TER', 'QUA', 'QUI', 'SEX'])
  const [knowledge, setKnowledge] = useState<Record<string, number>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    void contestRepository.list().then((results) => {
      setContests(results)
      const requested = results.find((contest) => contest.slug === requestedSlug)
      setContestId(requested?.id ?? results[0]?.id ?? '')
    })
  }, [requestedSlug])

  const selectedContest = useMemo(
    () => contests.find((contest) => contest.id === contestId),
    [contestId, contests],
  )

  const toggleDay = (day: string) => {
    setSelectedDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (!selectedContest) {
      setError('Escolha um concurso para gerar o plano.')
      return
    }
    if (hours < 1 || hours > 40) {
      setError('Informe entre 1 e 40 horas de estudo por semana.')
      return
    }
    if (selectedDays.length === 0) {
      setError('Escolha pelo menos um dia disponível.')
      return
    }

    const orderedDays = weekdays
      .filter((weekday) => selectedDays.includes(weekday.short))
      .map((weekday) => weekday.short)
    const plan = generatePlan({
      contest: selectedContest,
      hoursPerWeek: hours,
      weekdays: orderedDays,
      knowledge,
    })
    savePlan(plan)
    navigate('/meu-plano?novo=1')
  }

  return (
    <div className="planner-page page">
      <section className="planner-intro">
        <div className="container">
          <Link className="back-link dark-link" to={selectedContest ? `/concursos/${selectedContest.slug}` : '/concursos'}>
            <ArrowLeft size={17} /> Voltar
          </Link>
          <div className="planner-intro-grid">
            <div>
              <p className="kicker"><Sparkles size={15} /> Plano inicial explicável</p>
              <h1>Vamos transformar seu objetivo em uma semana possível.</h1>
              <p>Três decisões bastam para gerar a primeira versão. Você poderá ajustar o plano depois.</p>
            </div>
            <ol className="planner-steps" aria-label="Etapas do planejamento">
              <li className="active"><span>1</span> Objetivo</li>
              <li className="active"><span>2</span> Rotina</li>
              <li className="active"><span>3</span> Nível atual</li>
              <li><span>4</span> Seu plano</li>
            </ol>
          </div>
        </div>
      </section>

      <form className="container planner-form" onSubmit={submit}>
        <section className="form-section">
          <div className="form-section-number">01</div>
          <div className="form-section-content">
            <div className="form-section-heading">
              <div><p className="eyebrow">Seu objetivo</p><h2>Para qual cargo você quer se preparar?</h2></div>
              <Info size={18} aria-label="Este protótipo usa cenários demonstrativos" />
            </div>
            <label className="field-label" htmlFor="contest-select">Concurso de referência</label>
            <select
              id="contest-select"
              value={contestId}
              onChange={(event) => {
                setContestId(event.target.value)
                setKnowledge({})
              }}
            >
              {contests.map((contest) => (
                <option key={contest.id} value={contest.id}>{contest.acronym} — {contest.title}</option>
              ))}
            </select>
            {selectedContest && (
              <div className="selected-contest-strip">
                <span className="organization-monogram">{selectedContest.acronym.slice(0, 3)}</span>
                <div><strong>{selectedContest.title}</strong><small>{selectedContest.organization}</small></div>
                <PhaseBadge phase={selectedContest.phase} />
              </div>
            )}
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-number">02</div>
          <div className="form-section-content">
            <div className="form-section-heading">
              <div><p className="eyebrow">Sua rotina</p><h2>Quanto tempo realmente cabe na sua semana?</h2></div>
              <Clock3 size={20} aria-hidden="true" />
            </div>
            <div className="hours-control">
              <label htmlFor="hours-range">Horas por semana</label>
              <output htmlFor="hours-range"><strong>{hours}h</strong><span>≈ {Math.round((hours * 60) / 50)} sessões</span></output>
              <input
                id="hours-range"
                type="range"
                min="1"
                max="40"
                value={hours}
                onChange={(event) => setHours(Number(event.target.value))}
              />
              <div className="range-labels"><span>1h</span><span>40h</span></div>
            </div>
            <fieldset className="weekday-fieldset">
              <legend>Em quais dias você consegue estudar?</legend>
              <div className="weekday-grid">
                {weekdays.map((day) => {
                  const selected = selectedDays.includes(day.short)
                  return (
                    <button
                      className={selected ? 'selected' : ''}
                      key={day.short}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleDay(day.short)}
                    >
                      {selected && <Check size={14} />}
                      <strong>{day.short}</strong>
                      <span>{day.label}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-number">03</div>
          <div className="form-section-content">
            <div className="form-section-heading">
              <div><p className="eyebrow">Seu ponto de partida</p><h2>Como você se sente em cada matéria?</h2></div>
              <Gauge size={20} aria-hidden="true" />
            </div>
            <p className="form-helper">Isso aumenta a prioridade das suas lacunas sem ignorar o peso da prova de referência.</p>
            <div className="knowledge-list">
              {selectedContest?.subjects.map((subject) => {
                const value = knowledge[subject.id] ?? 2
                return (
                  <div className="knowledge-row" key={subject.id}>
                    <div><label htmlFor={`knowledge-${subject.id}`}>{subject.name}</label><span>Peso demonstrativo: {subject.historicalWeight}%</span></div>
                    <div className="knowledge-control">
                      <input
                        id={`knowledge-${subject.id}`}
                        type="range"
                        min="0"
                        max="5"
                        value={value}
                        onChange={(event) => setKnowledge((current) => ({ ...current, [subject.id]: Number(event.target.value) }))}
                      />
                      <output htmlFor={`knowledge-${subject.id}`}>{knowledgeLabels[value]}</output>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="planner-submit-bar">
          <div><CalendarDays size={22} /><span><strong>Plano reproduzível</strong><small>Algoritmo v1.0 · salvo somente neste navegador</small></span></div>
          <button className="button button-accent button-large" type="submit">
            Gerar meu plano <ArrowRight size={19} />
          </button>
        </div>
      </form>
    </div>
  )
}
