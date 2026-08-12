import { CircleDot } from 'lucide-react'
import { evidenceLabels, phaseLabels } from '../../entities/contest/labels'
import type { ContestPhase, EvidenceKind } from '../../entities/contest/types'

export function PhaseBadge({ phase }: { phase: ContestPhase }) {
  return (
    <span className={`badge phase-${phase}`}>
      <CircleDot size={12} aria-hidden="true" />
      {phaseLabels[phase]}
    </span>
  )
}

export function EvidenceBadge({ evidence }: { evidence: EvidenceKind }) {
  return <span className={`evidence evidence-${evidence}`}>{evidenceLabels[evidence]}</span>
}
