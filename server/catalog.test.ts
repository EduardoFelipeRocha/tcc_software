import { describe, expect, it } from 'vitest'
import { officialContests, officialSources } from '../src/data/official/contests.ts'
import { mergeCatalogFeedHistory, validateCatalogFeed } from './catalog.ts'

function validFeed(contest = officialContests[0]) {
  const sources = contest.sourceIds.map((sourceId, index) => {
    const source = officialSources.find((candidate) => candidate.id === sourceId)
    if (!source) throw new Error(`Fonte ausente no teste: ${sourceId}`)
    return {
      ...source,
      url: index === 0 ? contest.officialUrl : source.url!,
      retrievedAt: '2026-08-14T11:55:00.000Z',
      checkedAt: contest.lastVerified,
      contentHash: 'a'.repeat(64),
    }
  })

  return {
    schemaVersion: 1 as const,
    provider: {
      id: 'feed-teste',
      name: 'Feed oficial de teste',
      homepage: 'https://example.gov.br/catalogo',
    },
    generatedAt: '2026-08-14T12:00:00.000Z',
    sources,
    contests: [contest],
  }
}

describe('feed remoto do catálogo', () => {
  it('aceita um snapshot rastreável com todas as fontes oficiais', () => {
    expect(validateCatalogFeed(validFeed()).contests).toHaveLength(1)
  })

  it('aceita identidade municipal auditável no feed', () => {
    const contest = officialContests.find(
      (candidate) => candidate.id === 'marica-guarda-previsto-2026',
    )
    if (!contest) throw new Error('Concurso municipal ausente no teste.')

    expect(validateCatalogFeed(validFeed(contest)).contests[0]).toMatchObject({
      municipalityName: 'Maricá',
      municipalityIbgeCode: '3302700',
    })
  })

  it('recusa concurso municipal sem identidade IBGE completa ou com código inválido', () => {
    const contest = officialContests.find(
      (candidate) => candidate.id === 'marica-guarda-previsto-2026',
    )
    if (!contest) throw new Error('Concurso municipal ausente no teste.')
    const feed = validFeed(contest)
    const missingIdentity = {
      ...feed,
      contests: feed.contests.map((candidate) => ({
        ...candidate,
        municipalityName: undefined,
        municipalityIbgeCode: undefined,
      })),
    }
    const invalidCode = {
      ...feed,
      contests: feed.contests.map((candidate) => ({
        ...candidate,
        municipalityIbgeCode: '330270',
      })),
    }

    expect(() => validateCatalogFeed(missingIdentity)).toThrow(/concurso municipal precisa/i)
    expect(() => validateCatalogFeed(invalidCode)).toThrow(/7 dígitos/i)
  })

  it('recusa fonte marcada como não oficial', () => {
    const feed = validFeed()
    const invalid = {
      ...feed,
      sources: feed.sources.map((source) => ({ ...source, official: false })),
    }

    expect(() => validateCatalogFeed(invalid)).toThrow()
  })

  it('recusa concurso que referencia evidência ausente', () => {
    const feed = validFeed()
    const invalid = {
      ...feed,
      contests: feed.contests.map((contest) => ({
        ...contest,
        sourceIds: ['fonte-inexistente'],
      })),
    }

    expect(() => validateCatalogFeed(invalid)).toThrow(/fonte oficial ausente/i)
  })

  it('preserva registros publicados quando um snapshot novo deixa de listá-los', () => {
    const previous = validateCatalogFeed(validFeed())
    const incoming = validateCatalogFeed({
      ...validFeed(),
      generatedAt: '2026-08-14T13:00:00.000Z',
      sources: [],
      contests: [],
    })

    const merged = mergeCatalogFeedHistory(previous, incoming)
    expect(merged.contests.map((contest) => contest.id)).toEqual(
      previous.contests.map((contest) => contest.id),
    )
    expect(merged.sources.map((source) => source.id)).toEqual(
      previous.sources.map((source) => source.id),
    )
  })

  it('recusa rollback para um snapshot gerado antes do já publicado', () => {
    const previous = validateCatalogFeed({
      ...validFeed(),
      generatedAt: '2026-08-14T13:00:00.000Z',
    })
    const older = validateCatalogFeed(validFeed())

    expect(() => mergeCatalogFeedHistory(previous, older)).toThrow(/snapshot mais antigo/i)
  })
})
