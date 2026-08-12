import type { ContestPhase, EvidenceKind } from './types'

export const phaseLabels: Record<ContestPhase, string> = {
  registration_open: 'Inscrições abertas',
  notice_published: 'Edital publicado',
  organizer_selected: 'Banca definida',
  committee_formed: 'Comissão formada',
  authorized: 'Autorizado',
  expected: 'Previsto',
  closed: 'Encerrado',
}

export const evidenceLabels: Record<EvidenceKind, string> = {
  official_current: 'Informação oficial atual',
  official_historical: 'Dado oficial histórico',
  projection: 'Projeção, não confirmada',
  demonstration: 'Cenário demonstrativo',
}
