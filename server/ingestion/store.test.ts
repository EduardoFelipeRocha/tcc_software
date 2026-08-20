import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { discoveryEventSchema } from './schemas.ts'
import { PendingDiscoveryStore } from './store.ts'
import { sha256 } from './utils.ts'

const temporaryDirectories: string[] = []

afterEach(() => {
  while (temporaryDirectories.length) {
    const directory = temporaryDirectories.pop()
    if (directory) rmSync(directory, { recursive: true, force: true })
  }
})

function pendingEvent() {
  const deduplicationKey = sha256('evento-marica')
  return discoveryEventSchema.parse({
    schemaVersion: 1,
    id: deduplicationKey,
    deduplicationKey,
    status: 'pending',
    requiresOfficialVerification: true,
    sourceId: 'querido-diario',
    sourceTrust: 'secondary',
    externalId: 'gazette:3302700:2026-08-14:1520',
    eventKind: 'authorization',
    municipality: { ibgeCode: '3302700', name: 'Maricá', uf: 'RJ' },
    title: 'Possível autorização de concurso — Maricá',
    excerpt: 'Autorização de concurso público para a Guarda Municipal.',
    evidenceUrl: 'https://diario.marica.rj.gov.br/edicao/1520.pdf',
    contentHash: sha256('conteudo'),
    contentHashScope: 'discovery_payload',
    publishedOn: '2026-08-14',
    discoveredAt: '2026-08-14T15:00:00.000Z',
    matchedSignals: ['concurso-autorizado'],
  })
}

describe('armazenamento append-only de descoberta', () => {
  it('persiste eventos pendentes e deduplica sem reescrever o log', () => {
    const directory = mkdtempSync(join(tmpdir(), 'guiaconcursos-discovery-'))
    temporaryDirectories.push(directory)
    const logFile = join(directory, 'events.jsonl')
    const store = new PendingDiscoveryStore({ logFile })
    const event = pendingEvent()

    expect(store.appendBatch({ events: [event] })).toMatchObject({
      insertedEvents: 1,
      deduplicatedEvents: 0,
    })
    const firstContents = readFileSync(logFile, 'utf8')
    expect(store.appendBatch({ events: [event] })).toMatchObject({
      insertedEvents: 0,
      deduplicatedEvents: 1,
    })
    expect(readFileSync(logFile, 'utf8')).toBe(firstContents)

    const reloaded = new PendingDiscoveryStore({ logFile })
    expect(reloaded.listEvents({ municipalityIbgeCode: '3302700' })).toEqual([event])
    expect(reloaded.getMetrics()).toMatchObject({
      pendingEvents: 1,
      municipalitiesWithSignals: 1,
      ufsWithSignals: 1,
    })
  })

  it('coloca um evento inválido em quarentena sem rejeitar os válidos', () => {
    const store = new PendingDiscoveryStore()
    const result = store.appendBatch({
      events: [pendingEvent(), { status: 'published' }],
      recordedAt: '2026-08-14T15:00:00.000Z',
    })

    expect(result.insertedEvents).toBe(1)
    expect(result.insertedQuarantineItems).toBe(1)
    expect(store.listQuarantined()).toHaveLength(1)
    expect(store.listEvents()).toHaveLength(1)
  })
})
