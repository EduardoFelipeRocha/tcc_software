import type { Contest } from '../../entities/contest/types'
import type { SessionKind, StoredStudyPlan, StudySession } from './types'

const sessionKinds: SessionKind[] = ['Teoria + resumo', 'Questões', 'Revisão ativa']

export interface PlannerInput {
  contest: Contest
  hoursPerWeek: number
  weekdays: string[]
  knowledge: Record<string, number>
}

export function generatePlan({
  contest,
  hoursPerWeek,
  weekdays,
  knowledge,
}: PlannerInput): StoredStudyPlan {
  if (hoursPerWeek <= 0 || weekdays.length === 0) {
    throw new Error('Informe uma disponibilidade semanal válida.')
  }
  if (!contest.studyReference) {
    throw new Error('Este concurso ainda não possui conteúdo programático oficial validado para o plano.')
  }

  const totalMinutes = Math.round(hoursPerWeek * 60)
  const sessionCount = Math.max(1, Math.round(totalMinutes / 50))
  const baseSessionMinutes = Math.floor(totalMinutes / sessionCount)
  const extraMinuteCount = totalMinutes % sessionCount
  const balancedWeight = 100 / contest.subjects.length
  const priorities = contest.subjects.map((subject) => {
    const informedKnowledge = knowledge[subject.id] ?? 2
    const gap = 1 + (5 - informedKnowledge) / 5
    const baseWeight = contest.studyBasis === 'official_distribution'
      ? subject.historicalWeight
      : balancedWeight

    return {
      subject,
      baseWeight,
      priority: baseWeight * gap,
      assigned: 0,
    }
  })

  const sessions: StudySession[] = []

  for (let index = 0; index < sessionCount; index += 1) {
    const previousSubjectId = sessions.at(-1)?.subjectId
    const twoSessionsAgoSubjectId = sessions.at(-2)?.subjectId
    const uncovered = sessionCount >= priorities.length
      ? priorities.filter((candidate) => candidate.assigned === 0)
      : []
    const ranked = [...(uncovered.length ? uncovered : priorities)].sort((left, right) => {
      const leftScore = left.priority / (left.assigned + 1)
      const rightScore = right.priority / (right.assigned + 1)

      if (rightScore !== leftScore) return rightScore - leftScore
      return left.subject.id.localeCompare(right.subject.id, 'pt-BR')
    })
    const selected =
      ranked.find(
        (candidate) =>
          candidate.subject.id !== previousSubjectId &&
          candidate.subject.id !== twoSessionsAgoSubjectId,
      ) ?? ranked[0]
    selected.assigned += 1

    const allocatedMinutes = baseSessionMinutes + (index < extraMinuteCount ? 1 : 0)

    sessions.push({
      id: `${contest.id}-${index + 1}`,
      weekday: weekdays[index % weekdays.length],
      subjectId: selected.subject.id,
      subjectName: selected.subject.name,
      topic: selected.subject.topics[(selected.assigned - 1) % selected.subject.topics.length] ?? 'Revisão geral da disciplina',
      minutes: allocatedMinutes,
      kind: sessionKinds[index % sessionKinds.length],
    })
  }

  return {
    version: 1,
    algorithmVersion: '1.0.0',
    contestId: contest.id,
    contestSlug: contest.slug,
    contestTitle: contest.title,
    organization: contest.acronym,
    referenceLabel: contest.studyReference.label,
    referenceType: contest.studyReference.type,
    referenceUrl: contest.studyReference.url,
    referenceNote: contest.studyReference.note,
    referenceYear: contest.studyReference.year,
    previousEditionLabel: contest.previousEdition.label,
    previousEditionUrl: contest.previousEdition.sourceUrl,
    previousEditionYear: contest.previousEdition.year,
    previousEditionNote: contest.previousEdition.note,
    weightingBasis: contest.studyBasis === 'official_distribution'
      ? 'official_distribution'
      : 'balanced_syllabus',
    generatedAt: new Date().toISOString(),
    hoursPerWeek,
    weekdays,
    sessions,
    subjects: contest.subjects.map((subject) => {
      const subjectSessions = sessions.filter((session) => session.subjectId === subject.id)
      return {
        id: subject.id,
        name: subject.name,
        topics: subject.topics,
        priority: priorities.find((candidate) => candidate.subject.id === subject.id)?.baseWeight ?? balancedWeight,
        sessionCount: subjectSessions.length,
        totalMinutes: subjectSessions.reduce((total, session) => total + session.minutes, 0),
      }
    }),
  }
}
