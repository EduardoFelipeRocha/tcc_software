import { describe, expect, it } from 'vitest'
import { officialContests } from '../official/contests'
import {
  applyCatalogLifecycle,
  buildCatalogMeta,
  filterAndSortContests,
  isContestVerificationStale,
} from './catalogRules'

describe('regras do catálogo', () => {
  it('filtra a UF de forma exata sem misturar concursos nacionais', () => {
    const results = filterAndSortContests([...officialContests], { uf: 'RJ' })

    expect(results.length).toBeGreaterThan(0)
    expect(results.every((contest) => contest.uf === 'RJ')).toBe(true)
    expect(results.some((contest) => contest.uf === 'BR')).toBe(false)
  })

  it('filtra município pelo código IBGE sem misturar outros locais da mesma UF', () => {
    const results = filterAndSortContests([...officialContests], {
      uf: 'RJ',
      municipality: '3302700',
    })

    expect(results.length).toBeGreaterThan(0)
    expect(results.every((contest) => contest.municipalityIbgeCode === '3302700')).toBe(true)
    expect(results.map((contest) => contest.id)).toContain('marica-guarda-previsto-2026')
    expect(results.some((contest) => contest.municipalityName === 'Saquarema')).toBe(false)
  })

  it.each([
    ['Bombeiros RJ', 'cbmerj-cadete-2024'],
    ['Nível médio no RJ', 'cbmerj-cadete-2024'],
    ['Área fiscal', 'receita-federal-autorizado-2026'],
    ['Concursos federais', 'receita-federal-autorizado-2026'],
  ])('entende a busca natural %s', (query, expectedId) => {
    const results = filterAndSortContests([...officialContests], { query })

    expect(results.map((contest) => contest.id)).toContain(expectedId)
  })

  it('abre e encerra a janela de inscrição automaticamente no fuso de Brasília', () => {
    const trindade = officialContests.find((contest) => contest.id === 'camara-trindade-2026')
    const abare = officialContests.find((contest) => contest.id === 'abare-acs-2026')
    expect(trindade).toBeTruthy()
    expect(abare).toBeTruthy()

    expect(applyCatalogLifecycle(trindade!, new Date('2026-08-20T15:00:00Z')).phase)
      .toBe('registration_open')

    const ended = applyCatalogLifecycle({
      ...abare!,
      phase: 'notice_published',
      deadlineLabel: 'Inscrições abertas',
    }, new Date('2026-08-14T15:00:00Z'))
    expect(ended.phase).toBe('in_progress')
    expect(ended.deadlineLabel).toContain('12/08/2026')
  })

  it('calcula transparência de cobertura e registros vencidos', () => {
    const now = new Date('2026-08-20T15:00:00Z')
    const contests = officialContests.map((contest) => applyCatalogLifecycle(contest, now))
    const meta = buildCatalogMeta(contests, { mode: 'bundled', now })

    expect(meta.total).toBe(officialContests.length)
    expect(meta.regionalUnitsCovered).toBeGreaterThan(0)
    expect(meta.municipalitiesWithPublishedRecords).toBe(7)
    expect(meta.stale).toBe(
      contests.filter((contest) => isContestVerificationStale(contest, now)).length,
    )
  })
})
