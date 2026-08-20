export type SessionKind = 'Teoria + resumo' | 'Questões' | 'Revisão ativa'

export interface StudySession {
  id: string
  weekday: string
  subjectId: string
  subjectName: string
  topic: string
  minutes: number
  kind: SessionKind
}

export interface PlanSubjectSummary {
  id: string
  name: string
  topics: string[]
  priority: number
  sessionCount: number
  totalMinutes: number
}

export interface StoredStudyPlan {
  version: 1
  algorithmVersion: '1.0.0'
  contestId: string
  contestSlug: string
  contestTitle: string
  organization: string
  referenceLabel: string
  referenceType: 'current_notice' | 'previous_notice' | 'official_exam' | 'legacy_unverified'
  referenceUrl: string
  referenceNote: string
  referenceYear?: number
  previousEditionLabel?: string
  previousEditionUrl?: string
  previousEditionYear?: number
  previousEditionNote?: string
  weightingBasis: 'official_distribution' | 'balanced_syllabus'
  generatedAt: string
  hoursPerWeek: number
  weekdays: string[]
  sessions: StudySession[]
  subjects: PlanSubjectSummary[]
}
