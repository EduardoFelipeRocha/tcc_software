import { ArrowRight, BookOpen, Check, ExternalLink, FileCheck2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { contestRepository } from '../data/repositories/contestRepository'
import type { Contest } from '../entities/contest/types'

export function PreviousExamsPage() {
  const [contests, setContests] = useState<Contest[]>([])

  useEffect(() => {
    let active = true
    void contestRepository.list().then((results) => {
      if (active) setContests(results.filter((contest) => contest.previousEdition.examUrl))
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="page previous-exams-page">
      <section className="page-hero previous-exams-hero">
        <div className="container page-hero-grid">
          <div>
            <p className="kicker light"><FileCheck2 size={15} /> Acervo oficial</p>
            <h1>Provas anteriores e gabaritos no mesmo lugar.</h1>
            <p>Use materiais publicados pelos órgãos e bancas para conhecer o formato real da seleção. O ano e a edição ficam sempre visíveis.</p>
          </div>
          <div className="coverage-card">
            <span className="coverage-icon"><Check size={20} /></span>
            <div><strong>Sem arquivos inventados</strong><p>Cada botão leva ao documento oficial ou à página oficial que reúne os cadernos.</p></div>
          </div>
        </div>
      </section>

      <section className="section container exam-library" aria-labelledby="exam-library-title">
        <div className="section-heading split-heading">
          <div><p className="kicker">Materiais disponíveis</p><h2 id="exam-library-title">Escolha uma prova para estudar.</h2></div>
          <p className="exam-library-count">{contests.length} seleções com material oficial vinculado</p>
        </div>

        <div className="exam-library-grid">
          {contests.map((contest) => (
            <article className="exam-library-card" key={contest.id}>
              <div className="exam-library-heading">
                <span className="organization-monogram">{contest.acronym.slice(0, 3)}</span>
                <div><p className="eyebrow">{contest.acronym}</p><h3>{contest.title}</h3></div>
              </div>
              <p>{contest.previousEdition.note}</p>
              <dl>
                <div><dt>Edição</dt><dd>{contest.previousEdition.year ?? 'Consulte a fonte'}</dd></div>
                <div><dt>Banca</dt><dd>{contest.previousEdition.organizer ?? contest.organizer}</dd></div>
              </dl>
              <div className="exam-library-actions">
                <a className="button button-secondary" href={contest.previousEdition.examUrl} target="_blank" rel="noreferrer"><BookOpen size={16} /> Abrir prova</a>
                {contest.previousEdition.examSecondaryUrl && <a className="button button-secondary" href={contest.previousEdition.examSecondaryUrl} target="_blank" rel="noreferrer"><BookOpen size={16} /> Prova específica</a>}
                {contest.previousEdition.answerKeyUrl && <a className="button button-primary" href={contest.previousEdition.answerKeyUrl} target="_blank" rel="noreferrer"><Check size={16} /> Gabarito</a>}
                {contest.previousEdition.answerKeySecondaryUrl && <a className="button button-primary" href={contest.previousEdition.answerKeySecondaryUrl} target="_blank" rel="noreferrer"><Check size={16} /> Gabarito específico</a>}
              </div>
              <div className="exam-library-footer">
                <a href={contest.previousEdition.sourceUrl ?? contest.officialUrl} target="_blank" rel="noreferrer">Conferir origem <ExternalLink size={14} /></a>
                <Link to={`/concursos/${contest.slug}`}>Ver concurso <ArrowRight size={14} /></Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
