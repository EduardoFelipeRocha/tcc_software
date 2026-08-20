import { describe, expect, it } from 'vitest'
import type { StoredStudyPlan } from './types'
import {
  compatibleCompletedSessionIds,
  findStudyState,
  refreshVerifiedPlanTopics,
  type StudyLibrary,
} from './studyRepository'

function plan(topic: string): StoredStudyPlan {
  return {
    version: 1,
    algorithmVersion: '1.0.0',
    contestId: 'concurso-a',
    contestSlug: 'concurso-a',
    contestTitle: 'Concurso A',
    organization: 'Órgão A',
    referenceLabel: 'Edital A',
    referenceType: 'current_notice',
    referenceUrl: 'https://example.gov.br/edital.pdf',
    referenceNote: 'Fixture de teste.',
    weightingBasis: 'official_distribution',
    generatedAt: '2026-08-12T12:00:00.000Z',
    hoursPerWeek: 1,
    weekdays: ['SEG'],
    sessions: [{
      id: 'concurso-a-1',
      weekday: 'SEG',
      subjectId: 'portugues',
      subjectName: 'Português',
      topic,
      minutes: 60,
      kind: 'Teoria + resumo',
    }],
    subjects: [{
      id: 'portugues',
      name: 'Português',
      topics: [topic],
      priority: 100,
      sessionCount: 1,
      totalMinutes: 60,
    }],
  }
}

describe('studyRepository helpers', () => {
  it('preserva conclusão somente quando a sessão recalculada mantém o mesmo conteúdo', () => {
    expect(compatibleCompletedSessionIds(plan('Interpretação'), plan('Interpretação'), ['concurso-a-1']))
      .toEqual(['concurso-a-1'])
    expect(compatibleCompletedSessionIds(plan('Interpretação'), plan('Ortografia'), ['concurso-a-1']))
      .toEqual([])
  })

  it('encontra o plano solicitado sem misturar progresso entre objetivos', () => {
    const secondPlan = { ...plan('Direito'), contestId: 'concurso-b', contestSlug: 'concurso-b' }
    const library: StudyLibrary = {
      version: 1,
      activePlanId: 'concurso-a',
      updatedAt: '2026-08-12T12:00:00.000Z',
      plans: [
        { plan: plan('Português'), completedSessionIds: ['concurso-a-1'], updatedAt: '2026-08-12T12:00:00.000Z' },
        { plan: secondPlan, completedSessionIds: [], updatedAt: '2026-08-12T11:00:00.000Z' },
      ],
    }

    expect(findStudyState(library, 'concurso-b')?.plan.contestId).toBe('concurso-b')
    expect(findStudyState(library, 'concurso-b')?.completedSessionIds).toEqual([])
    expect(findStudyState(library, 'plano-excluido')).toBeNull()
  })

  it('atualiza o roteiro de um plano salvo sem alterar sua distribuição ou progresso', () => {
    const storedSummary = {
      id: 'matematica',
      name: 'Matemática',
      topics: ['Raciocínio lógico e situações-problema'],
      priority: 15,
      sessionCount: 2,
      totalMinutes: 100,
    }
    const refreshed = refreshVerifiedPlanTopics(
      'pmesp-aluno-soldado-2026',
      'https://concursos.policiamilitar.sp.gov.br/wp-content/uploads/2026/06/PMES2601_306_20260602183524.pdf.pdf',
      2026,
      [storedSummary],
    )

    expect(refreshed[0].topics).not.toEqual(storedSummary.topics)
    expect(refreshed[0].topics.length).toBeGreaterThan(10)
    expect(refreshed[0]).toMatchObject({ priority: 15, sessionCount: 2, totalMinutes: 100 })
  })

  it('não mistura conteúdo quando a edição oficial é diferente', () => {
    const storedSummary = {
      id: 'matematica',
      name: 'Matemática antiga',
      topics: ['Conteúdo da edição anterior'],
      priority: 100,
      sessionCount: 1,
      totalMinutes: 60,
    }

    expect(refreshVerifiedPlanTopics(
      'pmesp-aluno-soldado-2026',
      'https://example.gov.br/outro-edital.pdf',
      2025,
      [storedSummary],
    )).toEqual([storedSummary])
  })
})
