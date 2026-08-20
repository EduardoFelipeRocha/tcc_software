import { describe, expect, it } from 'vitest'
import { contestRepository } from './contestRepository'

describe('contestRepository', () => {
  it('combina termos de busca mesmo quando aparecem separados nos dados', async () => {
    const results = await contestRepository.list({ query: 'Bombeiros RJ' })

    expect(results.map((contest) => contest.id)).toContain('cbmerj-cadete-2024')
  })

  it('normaliza acentos e caixa na busca', async () => {
    const results = await contestRepository.list({ query: 'tecnico judiciaria' })

    expect(results.map((contest) => contest.id)).toContain('tjrj-tecnico-2025')
  })

  it.each([
    ['Nível médio no RJ', 'cbmerj-cadete-2024'],
    ['Área fiscal', 'receita-federal-autorizado-2026'],
    ['Concursos federais', 'receita-federal-autorizado-2026'],
  ])('não perde a sugestão natural %s', async (query, expectedId) => {
    const results = await contestRepository.list({ query })

    expect(results.map((contest) => contest.id)).toContain(expectedId)
  })

  it('não inclui registros nacionais ao filtrar uma UF específica', async () => {
    const results = await contestRepository.list({ uf: 'SP' })

    expect(results.length).toBeGreaterThan(0)
    expect(results.every((contest) => contest.uf === 'SP')).toBe(true)
  })

  it('separa concursos encerrados para consulta de provas anteriores', async () => {
    const results = await contestRepository.list({ phase: 'closed' })

    expect(results.length).toBeGreaterThan(0)
    expect(results.every((contest) => contest.phase === 'closed')).toBe(true)
  })

  it('prioriza concursos ativos e respeita os destaques editoriais', async () => {
    const listed = await contestRepository.list()
    const featured = await contestRepository.getFeatured()
    const firstClosedIndex = listed.findIndex((contest) => contest.phase === 'closed')
    const lastActiveIndex = listed.reduce(
      (lastIndex, contest, index) => contest.phase !== 'closed' ? index : lastIndex,
      -1,
    )

    expect(firstClosedIndex).toBeGreaterThan(lastActiveIndex)
    expect(featured.map((contest) => contest.id)).toContain('ses-iaserj-banca-2026')
    expect(featured.every((contest) => contest.phase !== 'closed')).toBe(true)
  })

  it('só libera planos com referência oficial, tópicos e distribuição coerentes', async () => {
    const results = await contestRepository.list()
    const ready = results.filter((contest) => contest.studyReference)

    expect(ready.length).toBeGreaterThanOrEqual(10)
    ready.forEach((contest) => {
      expect(contest.studyReference?.url).toMatch(/^https:\/\//)
      expect(contest.subjects.length).toBeGreaterThan(0)
      expect(contest.subjects.every((subject) => subject.topics.length > 0)).toBe(true)
      expect(new Set(contest.subjects.map((subject) => subject.id)).size).toBe(contest.subjects.length)
      expect(contest.subjects.reduce((total, subject) => total + subject.historicalWeight, 0)).toBeCloseTo(100, 1)
    })
  })

  it('usa a matriz correta de Guarda-Vidas sem incluir Matemática', async () => {
    const contest = await contestRepository.getBySlug('saquarema-guarda-vidas-2026')

    expect(contest?.subjects.map((subject) => subject.id)).toEqual([
      'especificos',
      'portugues',
      'municipio-legislacao',
    ])
    expect(contest?.studyReference?.type).toBe('current_notice')
  })

  it('bloqueia plano genérico em registros que agrupam cargos diferentes', async () => {
    const results = await contestRepository.list()
    const aggregatedIds = [
      'ifsc-tae-2026',
      'santos-medicos-2026',
      'receita-federal-autorizado-2026',
      'bcb-auditor-tecnico-2026',
      'ses-iaserj-banca-2026',
    ]

    aggregatedIds.forEach((id) => {
      const contest = results.find((candidate) => candidate.id === id)
      expect(contest?.studyReference).toBeUndefined()
      expect(contest?.studyUnavailableReason).toBeTruthy()
    })
  })
})
