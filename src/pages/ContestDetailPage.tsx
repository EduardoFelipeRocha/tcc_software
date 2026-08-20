import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  CircleDollarSign,
  ExternalLink,
  FileQuestion,
  Info,
  MapPin,
  ShieldAlert,
  Sparkles,
  WalletCards,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { isContestVerificationStale } from '../data/catalog/catalogRules'
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
    return <div className="container page-loading">Carregando concurso…</div>
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

  const hasOfficialStudyBasis = Boolean(contest.studyBasis)
  const verificationIsStale = isContestVerificationStale(contest)

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
              {contest.studyReference ? (
                <Link className="button button-accent" to={`/planejamento/novo?concurso=${contest.slug}`}>
                  Criar plano para este cargo <ArrowRight size={18} />
                </Link>
              ) : (
                <>
                  <button className="button button-disabled" type="button" disabled>Plano aguardando validação do conteúdo</button>
                  <small><ShieldAlert size={14} /> {contest.studyUnavailableReason ?? 'Este registro ainda não possui conteúdo programático oficial validado para o plano.'}</small>
                </>
              )}
              {contest.phase === 'registration_open' && contest.applicationUrl ? (
                <a className="button official-application-link" href={contest.applicationUrl} target="_blank" rel="noreferrer">
                  Ir para inscrição oficial <ExternalLink size={17} />
                </a>
              ) : (
                <small><ShieldAlert size={14} /> Inscrições não estão abertas neste momento.</small>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="container detail-layout">
        <main className="detail-main">
          <section className={`detail-section official-alert${verificationIsStale ? ' verification-stale' : ''}`}>
            <ShieldAlert size={22} />
            <div>
              <h2>{verificationIsStale ? 'Fonte oficial exige nova conferência' : 'Informação verificada em fonte oficial'}</h2>
              <p>
                A situação “{phaseLabels[contest.phase]}” foi conferida em {new Intl.DateTimeFormat('pt-BR').format(new Date(`${contest.lastVerified}T12:00:00`))}.
                {verificationIsStale
                  ? ' A janela de atualização deste registro venceu; confirme tudo na origem antes de tomar uma decisão.'
                  : ' Confira retificações e requisitos diretamente no edital antes de pagar ou se inscrever.'}
              </p>
            </div>
          </section>

          <section className="detail-section">
            <div className="section-heading compact-heading">
              <p className="kicker">Visão geral</p>
              <h2>Resumo do concurso</h2>
            </div>
            <div className="fact-grid">
              <div><span>Vagas</span><strong>{contest.openingsLabel}</strong><small>Conforme fonte oficial</small></div>
              <div><span>Remuneração</span><strong>{contest.salaryLabel}</strong><small>Valor inicial/divulgado no edital</small></div>
              <div><span>Taxa</span><strong>{contest.feeLabel}</strong><small>Confira isenção e forma de pagamento</small></div>
              <div><span>Banca</span><strong>{contest.organizer}</strong><small>Organizadora informada</small></div>
              <div><span>Área</span><strong>{contest.area}</strong><small>Classificação do catálogo</small></div>
              <div><span>Abrangência</span><strong>{contest.scopeLabel}</strong><small>{contest.governmentLevel}</small></div>
            </div>
            <a className="official-source-button" href={contest.officialUrl} target="_blank" rel="noreferrer">
              <Info size={17} /> Abrir edital ou página oficial <ExternalLink size={15} />
            </a>
          </section>

          <section className="detail-section">
            <div className="section-heading compact-heading">
              <p className="kicker">Conteúdo de referência</p>
              <h2>{contest.studyReference ? 'Matérias que entrarão no seu plano' : 'Plano ainda indisponível para este registro'}</h2>
              <p>
                {contest.studyReference && hasOfficialStudyBasis
                  ? 'As matérias e prioridades abaixo foram estruturadas a partir da distribuição ou do conteúdo programático oficial indicado.'
                  : contest.studyUnavailableReason ?? 'O conteúdo precisa ser conferido em documento oficial antes de poder gerar um plano.'}
              </p>
            </div>
            {contest.studyReference && <a className="official-source-button study-reference-button" href={contest.studyReference.url} target="_blank" rel="noreferrer">
              <BookOpen size={17} /> Abrir {contest.studyReference.label} <ExternalLink size={15} />
            </a>}
            {contest.studyReference && <div className="subject-list">
              {contest.subjects.map((subject) => (
                <article className="subject-row" key={subject.id}>
                  <div className="subject-row-header">
                    <div><strong>{subject.name}</strong><span>{subject.topics.slice(0, 2).join(' · ')}</span></div>
                    <b>{subject.historicalWeight}%</b>
                  </div>
                  <div className="weight-track" aria-label={`Prioridade inicial: ${subject.historicalWeight}%`}>
                    <span style={{ width: `${Math.min(100, subject.historicalWeight)}%` }} />
                  </div>
                </article>
              ))}
            </div>}
          </section>

          <section className="detail-section">
            <div className="section-heading compact-heading">
              <p className="kicker">Prova e gabarito</p>
              <h2>{contest.previousEdition.label}</h2>
            </div>
            <div className="previous-exam-card">
              <span className="exam-icon"><FileQuestion size={26} /></span>
              <div>
                <strong>{contest.previousEdition.examUrl ? 'Material oficial disponível' : 'Sem caderno oficial vinculado'}</strong>
                <p>{contest.previousEdition.note}</p>
              </div>
              {contest.previousEdition.examUrl ? (
                <div className="exam-actions">
                  <a className="button button-secondary" href={contest.previousEdition.examUrl} target="_blank" rel="noreferrer"><BookOpen size={16} /> Abrir prova</a>
                  {contest.previousEdition.examSecondaryUrl && <a className="button button-secondary" href={contest.previousEdition.examSecondaryUrl} target="_blank" rel="noreferrer"><BookOpen size={16} /> Prova específica</a>}
                  {contest.previousEdition.answerKeyUrl && <a className="button button-primary" href={contest.previousEdition.answerKeyUrl} target="_blank" rel="noreferrer"><Check size={16} /> Ver gabarito</a>}
                  {contest.previousEdition.answerKeySecondaryUrl && <a className="button button-primary" href={contest.previousEdition.answerKeySecondaryUrl} target="_blank" rel="noreferrer"><Check size={16} /> Gabarito específico</a>}
                </div>
              ) : (
                <button className="button button-disabled" type="button" disabled><ExternalLink size={16} /> Prova indisponível</button>
              )}
            </div>
          </section>
        </main>

        <aside className="detail-sidebar">
          <div className="source-card">
            <span className="source-card-icon"><Check size={21} /></span>
            <p className="eyebrow">Proveniência</p>
            <h2>Origem identificada</h2>
            <p>{contest.organization} · verificado em {new Intl.DateTimeFormat('pt-BR').format(new Date(`${contest.lastVerified}T12:00:00`))}.</p>
            <ul>
              <li><Check size={15} /> Situação baseada em publicação oficial</li>
              <li><WalletCards size={15} /> Salário: {contest.salaryLabel}</li>
              <li><CircleDollarSign size={15} /> Taxa: {contest.feeLabel}</li>
            </ul>
            <a className="text-link" href={contest.officialUrl} target="_blank" rel="noreferrer">Conferir fonte <ExternalLink size={14} /></a>
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
