import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  ExternalLink,
  FileQuestion,
  Info,
  MapPin,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { contestRepository } from '../data/repositories/contestRepository'
import { phaseLabels } from '../entities/contest/labels'
import type { Contest } from '../entities/contest/types'
import { EvidenceBadge, PhaseBadge } from '../shared/ui/StatusBadge'

export function ContestDetailPage() {
  const { slug = '' } = useParams()
  const [contest, setContest] = useState<Contest | null | undefined>(undefined)

  useEffect(() => {
    void contestRepository.getBySlug(slug).then((result) => setContest(result ?? null))
  }, [slug])

  if (contest === undefined) {
    return <div className="container page-loading">Carregando cenário…</div>
  }

  if (contest === null) {
    return (
      <div className="container empty-state standalone-empty">
        <FileQuestion size={32} />
        <h1>Concurso não encontrado</h1>
        <Link className="button button-primary" to="/concursos">Voltar ao catálogo</Link>
      </div>
    )
  }

  return (
    <div className="detail-page">
      <section className="detail-hero">
        <div className="container">
          <Link className="back-link" to="/concursos"><ArrowLeft size={17} /> Voltar para concursos</Link>
          <div className="detail-title-grid">
            <div>
              <div className="detail-badges">
                <PhaseBadge phase={contest.phase} />
                <EvidenceBadge evidence={contest.evidence} />
              </div>
              <p className="eyebrow light">{contest.acronym} · {contest.governmentLevel}</p>
              <h1>{contest.title}</h1>
              <p className="detail-organization">{contest.organization}</p>
              <div className="detail-inline-meta">
                <span><MapPin size={16} /> {contest.scopeLabel}</span>
                <span><BookOpen size={16} /> {contest.education.join(', ')}</span>
                <span><CalendarClock size={16} /> {contest.deadlineLabel}</span>
              </div>
            </div>
            <div className="detail-actions-card">
              <p>Quer se preparar para este objetivo?</p>
              <strong>Monte uma semana baseada no seu tempo e nas disciplinas de referência.</strong>
              <Link className="button button-accent" to={`/planejamento/novo?concurso=${contest.slug}`}>
                Criar plano para este cargo <ArrowRight size={18} />
              </Link>
              <small><ShieldAlert size={14} /> Não há link de inscrição porque este é um cenário demonstrativo.</small>
            </div>
          </div>
        </div>
      </section>

      <div className="container detail-layout">
        <main className="detail-main">
          <section className="detail-section trust-alert">
            <Info size={22} />
            <div>
              <h2>Antes de usar esta informação</h2>
              <p>
                A situação “{phaseLabels[contest.phase]}” nesta página serve apenas para testar a interface.
                Em produção, ela só será publicada com um ato oficial, a data de verificação e eventuais retificações.
              </p>
            </div>
          </section>

          <section className="detail-section">
            <div className="section-heading compact-heading">
              <p className="kicker">Visão geral</p>
              <h2>O que já sabemos neste cenário</h2>
            </div>
            <div className="fact-grid">
              <div><span>Vagas</span><strong>{contest.openingsLabel}</strong><small>Cenário demonstrativo</small></div>
              <div><span>Remuneração</span><strong>{contest.salaryLabel}</strong><small>Sem valor não verificado</small></div>
              <div><span>Área</span><strong>{contest.area}</strong><small>Classificação do catálogo</small></div>
              <div><span>Abrangência</span><strong>{contest.scopeLabel}</strong><small>{contest.governmentLevel}</small></div>
            </div>
          </section>

          <section className="detail-section">
            <div className="section-heading compact-heading">
              <p className="kicker">Conteúdo de referência</p>
              <h2>Distribuição usada no plano demonstrativo</h2>
              <p>Estes pesos são apenas exemplos do algoritmo e serão substituídos pela análise da prova oficial anterior.</p>
            </div>
            <div className="subject-list">
              {contest.subjects.map((subject) => (
                <article className="subject-row" key={subject.id}>
                  <div className="subject-row-header">
                    <div><strong>{subject.name}</strong><span>{subject.topics.slice(0, 2).join(' · ')}</span></div>
                    <b>{subject.historicalWeight}%</b>
                  </div>
                  <div className="weight-track" aria-label={`Peso demonstrativo: ${subject.historicalWeight}%`}>
                    <span style={{ width: `${subject.historicalWeight * 2.5}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="detail-section">
            <div className="section-heading compact-heading">
              <p className="kicker">Prova e gabarito</p>
              <h2>{contest.previousEdition.label}</h2>
            </div>
            <div className="previous-exam-card">
              <span className="exam-icon"><FileQuestion size={26} /></span>
              <div>
                <strong>Documentos aguardando validação</strong>
                <p>{contest.previousEdition.note}</p>
              </div>
              <button className="button button-disabled" type="button" disabled>
                <ExternalLink size={16} /> Abrir prova
              </button>
            </div>
          </section>
        </main>

        <aside className="detail-sidebar">
          <div className="source-card">
            <span className="source-card-icon"><ShieldAlert size={21} /></span>
            <p className="eyebrow">Proveniência</p>
            <h2>Fonte ainda não conectada</h2>
            <p>Este cenário existe para validar o produto. Ele não deve orientar inscrição ou pagamento.</p>
            <ul>
              <li><Check size={15} /> Interface identifica a natureza do dado</li>
              <li><Check size={15} /> Botões oficiais ficam bloqueados</li>
              <li><Check size={15} /> Futura fonte será registrada por campo</li>
            </ul>
          </div>
          <div className="method-card">
            <Sparkles size={20} />
            <h2>Por que esta prioridade?</h2>
            <p>O plano combina peso da prova de referência e dificuldade informada pelo candidato.</p>
            <Link className="text-link" to="/metodologia">Conhecer o método <ArrowRight size={15} /></Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
