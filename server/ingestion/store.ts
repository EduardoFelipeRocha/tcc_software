import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { z } from 'zod'
import {
  discoveryEventKindSchema,
  discoveryEventSchema,
  type DiscoveryEvent,
  quarantinedDiscoveryItemSchema,
  type QuarantinedDiscoveryItem,
  sourceIdSchema,
  stateCodeSchema,
  timestampSchema,
} from './schemas.ts'
import { boundedPreview, serializeForHash, sha256 } from './utils.ts'

const storedRecordSchema = z.discriminatedUnion('recordType', [
  z.object({ recordType: z.literal('event'), value: discoveryEventSchema }).strict(),
  z.object({ recordType: z.literal('quarantine'), value: quarantinedDiscoveryItemSchema }).strict(),
])

const eventFiltersSchema = z.object({
  sourceId: sourceIdSchema.optional(),
  municipalityIbgeCode: z.string().regex(/^\d{7}$/).optional(),
  uf: stateCodeSchema.optional(),
  eventKind: discoveryEventKindSchema.optional(),
  discoveredSince: timestampSchema.optional(),
  limit: z.number().int().min(1).max(1_000).optional().default(100),
}).strict()

export type DiscoveryEventFilters = z.input<typeof eventFiltersSchema>

export interface PendingDiscoveryStoreOptions {
  logFile?: string
}

export interface DiscoveryAppendResult {
  insertedEvents: number
  deduplicatedEvents: number
  insertedQuarantineItems: number
  deduplicatedQuarantineItems: number
}

export interface DiscoveryStoreMetrics {
  pendingEvents: number
  quarantinedItems: number
  deduplicatedEvents: number
  deduplicatedQuarantineItems: number
  municipalitiesWithSignals: number
  ufsWithSignals: number
  oldestPendingAt: string | null
  newestPendingAt: string | null
}

function quarantineInvalidRecord(
  value: unknown,
  itemIndex: number,
  reason: string,
  quarantinedAt: string,
): QuarantinedDiscoveryItem {
  const serialized = serializeForHash(value)
  const payloadHash = sha256(serialized)
  return quarantinedDiscoveryItemSchema.parse({
    schemaVersion: 1,
    id: sha256(`discovery-store\u0000${payloadHash}\u0000${reason}`),
    sourceId: 'discovery-store',
    itemIndex,
    quarantinedAt,
    reason: reason.slice(0, 1_000),
    payloadHash,
    payloadPreview: boundedPreview(value),
  })
}

export class PendingDiscoveryStore {
  readonly #logFile?: string
  readonly #eventsByDeduplicationKey = new Map<string, DiscoveryEvent>()
  readonly #quarantineById = new Map<string, QuarantinedDiscoveryItem>()
  #deduplicatedEvents = 0
  #deduplicatedQuarantineItems = 0

  constructor(options: PendingDiscoveryStoreOptions = {}) {
    this.#logFile = options.logFile ? resolve(options.logFile) : undefined
    this.#loadLog()
  }

  #loadLog() {
    if (!this.#logFile || !existsSync(this.#logFile)) return
    const contents = readFileSync(this.#logFile, 'utf8').replace(/^\uFEFF/, '')
    const lines = contents.split(/\r?\n/)
    lines.forEach((line, index) => {
      if (!line.trim()) return
      let decoded: unknown
      try {
        decoded = JSON.parse(line) as unknown
      } catch {
        throw new Error(`Log de descoberta corrompido na linha ${index + 1}.`)
      }
      const parsed = storedRecordSchema.safeParse(decoded)
      if (!parsed.success) {
        throw new Error(`Log de descoberta inválido na linha ${index + 1}.`)
      }
      if (parsed.data.recordType === 'event') {
        if (!this.#eventsByDeduplicationKey.has(parsed.data.value.deduplicationKey)) {
          this.#eventsByDeduplicationKey.set(
            parsed.data.value.deduplicationKey,
            parsed.data.value,
          )
        }
      } else if (!this.#quarantineById.has(parsed.data.value.id)) {
        this.#quarantineById.set(parsed.data.value.id, parsed.data.value)
      }
    })
  }

  #appendRecords(records: z.infer<typeof storedRecordSchema>[]) {
    if (!records.length || !this.#logFile) return
    mkdirSync(dirname(this.#logFile), { recursive: true })
    const serialized = `${records.map((record) => JSON.stringify(record)).join('\n')}\n`
    appendFileSync(this.#logFile, serialized, 'utf8')
  }

  appendBatch(batch: {
    events: readonly unknown[]
    quarantined?: readonly unknown[]
    recordedAt?: string
  }): DiscoveryAppendResult {
    const recordedAt = batch.recordedAt ?? new Date().toISOString()
    timestampSchema.parse(recordedAt)
    const newEvents: DiscoveryEvent[] = []
    const candidateQuarantine: QuarantinedDiscoveryItem[] = []
    let deduplicatedEvents = 0
    let deduplicatedQuarantineItems = 0

    batch.events.forEach((candidate, itemIndex) => {
      const parsed = discoveryEventSchema.safeParse(candidate)
      if (!parsed.success) {
        candidateQuarantine.push(quarantineInvalidRecord(
          candidate,
          itemIndex,
          `Evento inválido: ${parsed.error.issues[0]?.message ?? 'erro desconhecido'}`,
          recordedAt,
        ))
        return
      }
      const alreadyQueued = this.#eventsByDeduplicationKey.has(parsed.data.deduplicationKey) ||
        newEvents.some((event) => event.deduplicationKey === parsed.data.deduplicationKey)
      if (alreadyQueued) {
        deduplicatedEvents += 1
        return
      }
      newEvents.push(parsed.data)
    })

    ;(batch.quarantined ?? []).forEach((candidate, itemIndex) => {
      const parsed = quarantinedDiscoveryItemSchema.safeParse(candidate)
      candidateQuarantine.push(parsed.success
        ? parsed.data
        : quarantineInvalidRecord(
            candidate,
            itemIndex,
            `Item de quarentena inválido: ${parsed.error.issues[0]?.message ?? 'erro desconhecido'}`,
            recordedAt,
          ))
    })

    const newQuarantine: QuarantinedDiscoveryItem[] = []
    for (const item of candidateQuarantine) {
      const alreadyQueued = this.#quarantineById.has(item.id) ||
        newQuarantine.some((candidate) => candidate.id === item.id)
      if (alreadyQueued) {
        deduplicatedQuarantineItems += 1
      } else {
        newQuarantine.push(item)
      }
    }

    const records: z.infer<typeof storedRecordSchema>[] = [
      ...newEvents.map((value) => ({ recordType: 'event' as const, value })),
      ...newQuarantine.map((value) => ({ recordType: 'quarantine' as const, value })),
    ]
    this.#appendRecords(records)

    for (const event of newEvents) {
      this.#eventsByDeduplicationKey.set(event.deduplicationKey, event)
    }
    for (const item of newQuarantine) this.#quarantineById.set(item.id, item)
    this.#deduplicatedEvents += deduplicatedEvents
    this.#deduplicatedQuarantineItems += deduplicatedQuarantineItems

    return {
      insertedEvents: newEvents.length,
      deduplicatedEvents,
      insertedQuarantineItems: newQuarantine.length,
      deduplicatedQuarantineItems,
    }
  }

  listEvents(filters: DiscoveryEventFilters = {}) {
    const parsed = eventFiltersSchema.parse(filters)
    return [...this.#eventsByDeduplicationKey.values()]
      .filter((event) => (
        (!parsed.sourceId || event.sourceId === parsed.sourceId) &&
        (!parsed.municipalityIbgeCode ||
          event.municipality.ibgeCode === parsed.municipalityIbgeCode) &&
        (!parsed.uf || event.municipality.uf === parsed.uf) &&
        (!parsed.eventKind || event.eventKind === parsed.eventKind) &&
        (!parsed.discoveredSince || event.discoveredAt >= parsed.discoveredSince)
      ))
      .sort((left, right) => right.discoveredAt.localeCompare(left.discoveredAt))
      .slice(0, parsed.limit)
      .map((event) => structuredClone(event))
  }

  listQuarantined(limit = 100) {
    const parsedLimit = z.number().int().min(1).max(1_000).parse(limit)
    return [...this.#quarantineById.values()]
      .sort((left, right) => right.quarantinedAt.localeCompare(left.quarantinedAt))
      .slice(0, parsedLimit)
      .map((item) => structuredClone(item))
  }

  getMetrics(): DiscoveryStoreMetrics {
    const events = [...this.#eventsByDeduplicationKey.values()]
    const dates = events.map((event) => event.discoveredAt).sort()
    return {
      pendingEvents: events.length,
      quarantinedItems: this.#quarantineById.size,
      deduplicatedEvents: this.#deduplicatedEvents,
      deduplicatedQuarantineItems: this.#deduplicatedQuarantineItems,
      municipalitiesWithSignals: new Set(
        events.map((event) => event.municipality.ibgeCode),
      ).size,
      ufsWithSignals: new Set(events.map((event) => event.municipality.uf)).size,
      oldestPendingAt: dates[0] ?? null,
      newestPendingAt: dates.at(-1) ?? null,
    }
  }
}
