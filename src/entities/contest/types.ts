export type ContestPhase =
  | 'registration_open'
  | 'notice_published'
  | 'organizer_selected'
  | 'committee_formed'
  | 'authorized'
  | 'expected'
  | 'closed'

export type EvidenceKind =
  | 'official_current'
  | 'official_historical'
  | 'projection'
  | 'demonstration'

export type GovernmentLevel = 'Federal' | 'Estadual' | 'Municipal'

export interface Source {
  id: string
  title: string
  publisher: string
  url?: string
  checkedAt: string
  official: boolean
}

export interface Subject {
  id: string
  name: string
  historicalWeight: number
  topics: string[]
}

export interface PreviousEdition {
  label: string
  year?: number
  organizer?: string
  fee?: string
  note: string
}

export interface Contest {
  id: string
  slug: string
  title: string
  organization: string
  acronym: string
  governmentLevel: GovernmentLevel
  uf: string
  region: string
  scopeLabel: string
  area: string
  education: string[]
  phase: ContestPhase
  evidence: EvidenceKind
  shortDescription: string
  openingsLabel: string
  salaryLabel: string
  deadlineLabel: string
  featured: boolean
  sourceIds: string[]
  previousEdition: PreviousEdition
  subjects: Subject[]
}

export interface ContestFilters {
  query?: string
  uf?: string
  phase?: ContestPhase | 'all'
  education?: string
}
