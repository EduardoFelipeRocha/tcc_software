import { describe, expect, it } from 'vitest'
import type { Contest } from '../../entities/contest/types'
import { generatePlan } from './generatePlan'

const contest: Contest = {
  id: 'test-contest',
  slug: 'test-contest',
  title: 'Cargo de Teste',
  organization: 'Órgão de Teste',
  acronym: 'OT',
  governmentLevel: 'Federal',
  uf: 'BR',
  region: 'Brasil',
  scopeLabel: 'Nacional',
  area: 'Administrativa',
  education: ['Nível médio'],
  phase: 'expected',
  evidence: 'official_current',
  shortDescription: 'Fixture de teste',
  openingsLabel: 'A confirmar',
  salaryLabel: 'A confirmar',
  deadlineLabel: 'Sem prazo',
  feeLabel: 'R$ 10,00',
  organizer: 'Banca de teste',
  lastVerified: '2026-08-12',
  officialUrl: 'https://example.gov.br',
  featured: false,
  sourceIds: [],
  studyBasis: 'official_syllabus',
  studyReference: {
    type: 'current_notice',
    label: 'Edital de teste',
    url: 'https://example.gov.br/edital.pdf',
    note: 'Conteúdo usado somente na fixture.',
    year: 2026,
    contentVerifiedAt: '2026-08-12',
  },
  previousEdition: { label: 'Edição de teste', note: 'Fixture' },
  subjects: [
    { id: 'a', name: 'Matéria A', historicalWeight: 60, topics: [] },
    { id: 'b', name: 'Matéria B', historicalWeight: 40, topics: [] },
  ],
}

describe('generatePlan', () => {
  it('preserva exatamente a disponibilidade semanal informada', () => {
    const plan = generatePlan({
      contest,
      hoursPerWeek: 8,
      weekdays: ['SEG', 'TER', 'QUA'],
      knowledge: { a: 2, b: 2 },
    })

    expect(plan.sessions.reduce((total, session) => total + session.minutes, 0)).toBe(480)
    expect(plan.sessions.every((session) => session.minutes >= 45 && session.minutes <= 60)).toBe(true)
  })

  it('evita três sessões consecutivas da mesma matéria quando há alternativa', () => {
    const plan = generatePlan({
      contest,
      hoursPerWeek: 4,
      weekdays: ['SEG', 'TER'],
      knowledge: { a: 2, b: 2 },
    })

    plan.sessions.slice(2).forEach((session, index) => {
      const previous = plan.sessions[index + 1]
      const twoSessionsAgo = plan.sessions[index]
      expect(
        session.subjectId === previous.subjectId && session.subjectId === twoSessionsAgo.subjectId,
      ).toBe(false)
    })
  })

  it('aumenta a prioridade de uma matéria quando a lacuna é maior', () => {
    const balancedContest = {
      ...contest,
      subjects: contest.subjects.map((subject) => ({ ...subject, historicalWeight: 50 })),
    }
    const plan = generatePlan({
      contest: balancedContest,
      hoursPerWeek: 10,
      weekdays: ['SEG', 'TER', 'QUA', 'QUI', 'SEX'],
      knowledge: { a: 0, b: 5 },
    })
    const sessionsA = plan.sessions.filter((session) => session.subjectId === 'a').length
    const sessionsB = plan.sessions.filter((session) => session.subjectId === 'b').length

    expect(sessionsA).toBeGreaterThan(sessionsB)
  })

  it('cobre todas as matérias quando existem sessões suficientes', () => {
    const expandedContest = {
      ...contest,
      subjects: [
        ...contest.subjects,
        { id: 'c', name: 'Matéria C', historicalWeight: 5, topics: ['Tópico C'] },
        { id: 'd', name: 'Matéria D', historicalWeight: 5, topics: ['Tópico D'] },
      ],
    }
    const plan = generatePlan({
      contest: expandedContest,
      hoursPerWeek: 4,
      weekdays: ['SEG', 'TER'],
      knowledge: {},
    })

    expect(plan.sessions).toHaveLength(5)
    expect(new Set(plan.sessions.map((session) => session.subjectId))).toEqual(
      new Set(expandedContest.subjects.map((subject) => subject.id)),
    )
    expect(plan.subjects.every((subject) => subject.sessionCount >= 1)).toBe(true)
  })

  it('recusa disponibilidade inválida', () => {
    expect(() =>
      generatePlan({ contest, hoursPerWeek: 0, weekdays: ['SEG'], knowledge: {} }),
    ).toThrow('disponibilidade semanal válida')
  })
})
