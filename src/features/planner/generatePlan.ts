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

  const totalMinutes = Math.round(hoursPerWeek * 60)
  const sessionCount = Math.max(1, Math.round(totalMinutes / 50))
  const baseSessionMinutes = Math.floor(totalMinutes / sessionCount)
  const extraMinuteCount = totalMinutes % sessionCount
  const priorities = contest.subjects.map((subject) => {
    const informedKnowledge = knowledge[subject.id] ?? 2
    const gap = 1 + (5 - informedKnowledge) / 5

    return {
      subject,
      priority: subject.historicalWeight * gap,
      assigned: 0,
    }
  })

  const sessions: StudySession[] = []

  for (let index = 0; index < sessionCount; index += 1) {
    const previousSubjectId = sessions.at(-1)?.subjectId
    const twoSessionsAgoSubjectId = sessions.at(-2)?.subjectId
    const ranked = [...priorities].sort((left, right) => {
      const leftScore = left.priority / (left.assigned + 1)
      const rightScore = right.priority / (right.assigned + 1)

      if (rightScore !== leftScore) return rightScore - leftScore
      return left.subject.id.localeCompare(right.subject.id, 'pt-BR')
    })
    const selected =
      ranked.find(
        (candidate) =>
          candidate.subject.id !== previousSubjectId ||
          candidate.subject.id !== twoSessionsAgoSubjectId,
      ) ?? ranked[0]
    selected.assigned += 1

    const allocatedMinutes = baseSessionMinutes + (index < extraMinuteCount ? 1 : 0)

    sessions.push({
      id: `${contest.id}-${index + 1}`,
      weekday: weekdays[index % weekdays.length],
      subjectId: selected.subject.id,
      subjectName: selected.subject.name,
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
    referenceLabel: contest.previousEdition.label,
    generatedAt: new Date().toISOString(),
    hoursPerWeek,
    weekdays,
    sessions,
  }
}
