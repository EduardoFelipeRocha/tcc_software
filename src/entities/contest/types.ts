export type ContestPhase =
  | 'registration_open'
  | 'notice_published'
  | 'in_progress'
  | 'organizer_selected'
  | 'committee_formed'
  | 'authorized'
  | 'expected'
  | 'closed'

export type ContestPhaseFilter = ContestPhase | 'all' | 'preparation'

export type EvidenceKind =
  | 'official_current'
  | 'official_historical'
  | 'projection'

export type GovernmentLevel = 'Federal' | 'Estadual' | 'Municipal'

export interface Source {
  id: string
  title: string
  publisher: string
  url?: string
  checkedAt: string
  official: boolean
  retrievedAt?: string
  contentHash?: string
}

export interface Subject {
  id: string
  name: string
  historicalWeight: number
  topics: string[]
}

export type StudyReferenceType = 'current_notice' | 'previous_notice' | 'official_exam'

export interface StudyReference {
  type: StudyReferenceType
  label: string
  url: string
  note: string
  year?: number
  contentVerifiedAt: string
}

export interface PreviousEdition {
  label: string
  year?: number
  organizer?: string
  fee?: string
  note: string
  examUrl?: string
  examSecondaryUrl?: string
  answerKeyUrl?: string
  answerKeySecondaryUrl?: string
  sourceUrl?: string
}

export interface Contest {
  id: string
  slug: string
  title: string
  organization: string
  acronym: string
  governmentLevel: GovernmentLevel
  municipalityName?: string
  municipalityIbgeCode?: string
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
  feeLabel: string
  organizer: string
  lastVerified: string
  officialUrl: string
  applicationUrl?: string
  registrationStartsAt?: string
  registrationEndsAt?: string
  featured: boolean
  sourceIds: string[]
  studyBasis?: 'official_distribution' | 'official_syllabus'
  studyReference?: StudyReference
  studyUnavailableReason?: string
  previousEdition: PreviousEdition
  subjects: Subject[]
}

export interface ContestFilters {
  query?: string
  uf?: string
  municipality?: string
  phase?: ContestPhaseFilter
  education?: string
  governmentLevel?: GovernmentLevel | 'all'
  area?: string
  sort?: ContestSort
}

export type ContestSort = 'relevance' | 'recent' | 'deadline' | 'title'

export type CatalogMode = 'automatic' | 'bundled' | 'fallback'

export interface CatalogMeta {
  generatedAt: string
  lastSuccessfulSync: string | null
  nextScheduledSync: string | null
  newestVerification: string | null
  oldestVerification: string | null
  automaticUpdates: boolean
  configuredFeeds: number
  healthyFeeds: number
  failedFeeds: number
  total: number
  active: number
  stale: number
  regionalUnitsCovered: number
  municipalitiesWithPublishedRecords: number
  mode: CatalogMode
}

export interface CatalogSnapshot {
  contests: Contest[]
  meta: CatalogMeta
}
