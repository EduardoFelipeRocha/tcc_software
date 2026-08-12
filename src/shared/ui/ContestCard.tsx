import {
  ArrowUpRight,
  Bookmark,
  Building2,
  GraduationCap,
  MapPin,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Contest } from '../../entities/contest/types'
import { EvidenceBadge, PhaseBadge } from './StatusBadge'

interface ContestCardProps {
  contest: Contest
  compact?: boolean
}

export function ContestCard({ contest, compact = false }: ContestCardProps) {
  return (
    <article className={`contest-card${compact ? ' contest-card-compact' : ''}`}>
      <div className="contest-card-topline">
        <PhaseBadge phase={contest.phase} />
        <button className="save-button" type="button" aria-label={`Salvar ${contest.title}`}>
          <Bookmark size={18} />
        </button>
      </div>

      <div className="organization-row">
        <span className="organization-monogram" aria-hidden="true">
          {contest.acronym.slice(0, 3)}
        </span>
        <div>
          <p className="eyebrow">{contest.acronym}</p>
          <h3>{contest.title}</h3>
        </div>
      </div>

      {!compact && <p className="contest-summary">{contest.shortDescription}</p>}

      <dl className="contest-meta">
        <div>
          <dt>
            <MapPin size={15} aria-hidden="true" /> Abrangência
          </dt>
          <dd>{contest.scopeLabel}</dd>
        </div>
        <div>
          <dt>
            <GraduationCap size={15} aria-hidden="true" /> Escolaridade
          </dt>
          <dd>{contest.education.join(', ')}</dd>
        </div>
        {!compact && (
          <div>
            <dt>
              <Building2 size={15} aria-hidden="true" /> Esfera
            </dt>
            <dd>{contest.governmentLevel}</dd>
          </div>
        )}
      </dl>

      <div className="contest-card-footer">
        <div>
          <EvidenceBadge evidence={contest.evidence} />
          <span className="card-helper">Dados ainda não validados</span>
        </div>
        <Link className="card-link" to={`/concursos/${contest.slug}`}>
          Ver cenário <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}
