export type SessionKind = 'Teoria + resumo' | 'Questões' | 'Revisão ativa'

export interface StudySession {
  id: string
  weekday: string
  subjectId: string
  subjectName: string
  minutes: number
  kind: SessionKind
}

export interface StoredStudyPlan {
  version: 1
  algorithmVersion: '1.0.0'
  contestId: string
  contestSlug: string
  contestTitle: string
  organization: string
  referenceLabel: string
  generatedAt: string
  hoursPerWeek: number
  weekdays: string[]
  sessions: StudySession[]
}
