import {
  discoveryEventSchema,
  type DiscoveryEvent,
  type DiscoveryPage,
  manualSuggestionSchema,
  type ManualSuggestion,
  timestampSchema,
} from './schemas.ts'
import {
  PendingDiscoveryStore,
  type DiscoveryAppendResult,
  type DiscoveryEventFilters,
  type DiscoveryStoreMetrics,
} from './store.ts'
import {
  QueridoDiarioConnector,
  type QueridoDiarioQuery,
} from './queridoDiario.ts'
import { detectHighSignalTerms } from './signals.ts'
import { plainText, serializeForHash, sha256 } from './utils.ts'

export interface DiscoverySynchronizationOptions {
  enabled?: boolean
  connector?: DiscoveryConnector
  store?: PendingDiscoveryStore
  intervalMinutes?: number
  maximumPagesPerRun?: number
  query?: QueridoDiarioQuery
  runImmediately?: boolean
  clock?: () => Date
  onError?: (error: Error) => void
}

export interface DiscoveryConnector {
  fetchPage(query?: QueridoDiarioQuery): Promise<DiscoveryPage>
}

export interface DiscoveryRunSummary {
  startedAt: string
  completedAt: string
  pagesFetched: number
  itemsReceived: number
  ignoredWithoutSignal: number
  insertedEvents: number
  deduplicatedEvents: number
  insertedQuarantineItems: number
  deduplicatedQuarantineItems: number
  backlogRemaining: boolean
  resumeOffset: number
}

export interface DiscoverySynchronizationHandle {
  runNow(): Promise<DiscoveryRunSummary>
  stop(): void
}

export interface DiscoveryHealth {
  status: 'idle' | 'running' | 'healthy' | 'degraded'
  enabled: boolean
  running: boolean
  sourceId: 'querido-diario'
  lastAttemptAt: string | null
  lastSuccessfulRunAt: string | null
  lastFailedRunAt: string | null
  nextScheduledRunAt: string | null
  lastError: string | null
  runsStarted: number
  runsSucceeded: number
  runsFailed: number
  pagesFetched: number
  itemsReceived: number
  ignoredWithoutSignal: number
  backlogRemaining: boolean
  resumeOffset: number
  store: DiscoveryStoreMetrics
}

export interface ManualSuggestionResult {
  event: DiscoveryEvent
  inserted: boolean
  deduplicated: boolean
}

interface RuntimeState {
  enabled: boolean
  running: boolean
  lastAttemptAt: string | null
  lastSuccessfulRunAt: string | null
  lastFailedRunAt: string | null
  nextScheduledRunAt: string | null
  lastError: string | null
  runsStarted: number
  runsSucceeded: number
  runsFailed: number
  pagesFetched: number
  itemsReceived: number
  ignoredWithoutSignal: number
  backlogRemaining: boolean
  resumeOffset: number
}

const initialState = (): RuntimeState => ({
  enabled: false,
  running: false,
  lastAttemptAt: null,
  lastSuccessfulRunAt: null,
  lastFailedRunAt: null,
  nextScheduledRunAt: null,
  lastError: null,
  runsStarted: 0,
  runsSucceeded: 0,
  runsFailed: 0,
  pagesFetched: 0,
  itemsReceived: 0,
  ignoredWithoutSignal: 0,
  backlogRemaining: false,
  resumeOffset: 0,
})

let discoveryStore = new PendingDiscoveryStore()
let runtimeState = initialState()
let activeHandle: DiscoverySynchronizationHandle | null = null
let synchronizationInFlight: Promise<DiscoveryRunSummary> | null = null

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Falha desconhecida.'
  return message.replace(/https?:\/\/\S+/gi, '[URL removida]').slice(0, 500)
}

function validatedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  if (value === undefined) return fallback
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`O valor precisa estar entre ${minimum} e ${maximum}.`)
  }
  return value
}

function aggregateAppendResult(
  total: DiscoveryAppendResult,
  next: DiscoveryAppendResult,
): DiscoveryAppendResult {
  return {
    insertedEvents: total.insertedEvents + next.insertedEvents,
    deduplicatedEvents: total.deduplicatedEvents + next.deduplicatedEvents,
    insertedQuarantineItems:
      total.insertedQuarantineItems + next.insertedQuarantineItems,
    deduplicatedQuarantineItems:
      total.deduplicatedQuarantineItems + next.deduplicatedQuarantineItems,
  }
}

function appendPage(page: DiscoveryPage) {
  return discoveryStore.appendBatch({
    events: page.events,
    quarantined: page.quarantined,
    recordedAt: page.requestedAt,
  })
}

export function startDiscoverySynchronization(
  options: DiscoverySynchronizationOptions = {},
): DiscoverySynchronizationHandle {
  if (activeHandle) throw new Error('A sincronização de descoberta já está ativa.')

  const enabled = options.enabled ?? false
  const intervalMinutes = validatedInteger(options.intervalMinutes, 15, 5, 24 * 60)
  const maximumPagesPerRun = validatedInteger(options.maximumPagesPerRun, 20, 1, 100)
  const intervalMs = intervalMinutes * 60 * 1_000
  const connector = options.connector ?? new QueridoDiarioConnector()
  const clock = options.clock ?? (() => new Date())
  const baseQuery = { ...(options.query ?? {}) }
  const initialOffset = Number.isInteger(baseQuery.offset) ? baseQuery.offset ?? 0 : 0
  runtimeState = {
    ...runtimeState,
    enabled,
    running: false,
    nextScheduledRunAt: enabled
      ? new Date(clock().getTime() + intervalMs).toISOString()
      : null,
    resumeOffset: initialOffset,
  }

  if (options.store) {
    const currentMetrics = discoveryStore.getMetrics()
    if (currentMetrics.pendingEvents || currentMetrics.quarantinedItems) {
      throw new Error('Não é seguro trocar um armazenamento de descoberta que já possui dados.')
    }
    discoveryStore = options.store
  }

  let stopped = false
  let timer: ReturnType<typeof setInterval> | null = null

  const runNow = () => {
    if (!enabled || stopped) {
      return Promise.reject(new Error('A sincronização de descoberta não está habilitada.'))
    }
    if (synchronizationInFlight) return synchronizationInFlight

    synchronizationInFlight = (async () => {
      const startedAt = clock().toISOString()
      timestampSchema.parse(startedAt)
      runtimeState.running = true
      runtimeState.lastAttemptAt = startedAt
      runtimeState.runsStarted += 1
      runtimeState.lastError = null

      let pagesFetched = 0
      let itemsReceived = 0
      let ignoredWithoutSignal = 0
      let nextOffset: number | null = runtimeState.resumeOffset
      let appendResult: DiscoveryAppendResult = {
        insertedEvents: 0,
        deduplicatedEvents: 0,
        insertedQuarantineItems: 0,
        deduplicatedQuarantineItems: 0,
      }

      try {
        while (nextOffset !== null && pagesFetched < maximumPagesPerRun) {
          const page = await connector.fetchPage({
            ...baseQuery,
            offset: nextOffset,
          })
          pagesFetched += 1
          itemsReceived += page.receivedItems
          ignoredWithoutSignal += page.ignoredWithoutSignal
          appendResult = aggregateAppendResult(appendResult, appendPage(page))
          nextOffset = page.nextOffset
        }

        runtimeState.resumeOffset = nextOffset ?? initialOffset
        runtimeState.backlogRemaining = nextOffset !== null
        const completedAt = clock().toISOString()
        timestampSchema.parse(completedAt)
        runtimeState.running = false
        runtimeState.lastSuccessfulRunAt = completedAt
        runtimeState.runsSucceeded += 1
        runtimeState.pagesFetched += pagesFetched
        runtimeState.itemsReceived += itemsReceived
        runtimeState.ignoredWithoutSignal += ignoredWithoutSignal
        runtimeState.nextScheduledRunAt = stopped
          ? null
          : new Date(clock().getTime() + intervalMs).toISOString()

        return {
          startedAt,
          completedAt,
          pagesFetched,
          itemsReceived,
          ignoredWithoutSignal,
          ...appendResult,
          backlogRemaining: runtimeState.backlogRemaining,
          resumeOffset: runtimeState.resumeOffset,
        }
      } catch (error) {
        const failedAt = clock().toISOString()
        runtimeState.running = false
        runtimeState.lastFailedRunAt = failedAt
        runtimeState.lastError = safeErrorMessage(error)
        runtimeState.runsFailed += 1
        runtimeState.pagesFetched += pagesFetched
        runtimeState.itemsReceived += itemsReceived
        runtimeState.ignoredWithoutSignal += ignoredWithoutSignal
        runtimeState.nextScheduledRunAt = stopped
          ? null
          : new Date(clock().getTime() + intervalMs).toISOString()
        throw error
      }
    })().finally(() => {
      synchronizationInFlight = null
    })
    return synchronizationInFlight
  }

  const handle: DiscoverySynchronizationHandle = {
    runNow,
    stop() {
      if (stopped) return
      stopped = true
      if (timer) clearInterval(timer)
      timer = null
      runtimeState.enabled = false
      runtimeState.nextScheduledRunAt = null
      activeHandle = null
    },
  }
  activeHandle = handle

  if (enabled) {
    timer = setInterval(() => {
      runtimeState.nextScheduledRunAt = new Date(clock().getTime() + intervalMs).toISOString()
      void runNow().catch((error: unknown) => {
        options.onError?.(error instanceof Error ? error : new Error('Falha desconhecida.'))
      })
    }, intervalMs)
    timer.unref()
    if (options.runImmediately ?? true) {
      void runNow().catch((error: unknown) => {
        options.onError?.(error instanceof Error ? error : new Error('Falha desconhecida.'))
      })
    }
  }

  return handle
}

export function getDiscoveryHealth(): DiscoveryHealth {
  const status: DiscoveryHealth['status'] = runtimeState.running
    ? 'running'
    : runtimeState.lastError || runtimeState.backlogRemaining
      ? 'degraded'
      : runtimeState.lastSuccessfulRunAt
        ? 'healthy'
        : 'idle'
  return {
    status,
    enabled: runtimeState.enabled,
    running: runtimeState.running,
    sourceId: 'querido-diario',
    lastAttemptAt: runtimeState.lastAttemptAt,
    lastSuccessfulRunAt: runtimeState.lastSuccessfulRunAt,
    lastFailedRunAt: runtimeState.lastFailedRunAt,
    nextScheduledRunAt: runtimeState.nextScheduledRunAt,
    lastError: runtimeState.lastError,
    runsStarted: runtimeState.runsStarted,
    runsSucceeded: runtimeState.runsSucceeded,
    runsFailed: runtimeState.runsFailed,
    pagesFetched: runtimeState.pagesFetched,
    itemsReceived: runtimeState.itemsReceived,
    ignoredWithoutSignal: runtimeState.ignoredWithoutSignal,
    backlogRemaining: runtimeState.backlogRemaining,
    resumeOffset: runtimeState.resumeOffset,
    store: discoveryStore.getMetrics(),
  }
}

export function listDiscoveryEvents(filters: DiscoveryEventFilters = {}) {
  return discoveryStore.listEvents(filters)
}

export function submitManualDiscoverySuggestion(
  input: ManualSuggestion,
  options: { clock?: () => Date } = {},
): ManualSuggestionResult {
  const suggestion = manualSuggestionSchema.parse(input)
  const discoveredAt = (options.clock ?? (() => new Date()))().toISOString()
  timestampSchema.parse(discoveredAt)
  const evidenceUrl = new URL(suggestion.evidenceUrl)
  evidenceUrl.hash = ''
  const normalizedUrl = evidenceUrl.toString()
  const detected = detectHighSignalTerms(`${suggestion.title} ${suggestion.note}`)
  const contentHash = sha256(serializeForHash({
    ...suggestion,
    evidenceUrl: normalizedUrl,
  }))
  const deduplicationKey = sha256(
    `manual-suggestion\u0000${suggestion.municipalityIbgeCode}\u0000${normalizedUrl}`,
  )
  const event = discoveryEventSchema.parse({
    schemaVersion: 1,
    id: sha256(`${deduplicationKey}\u0000${contentHash}`),
    deduplicationKey,
    status: 'pending',
    requiresOfficialVerification: true,
    sourceId: 'manual-suggestion',
    sourceTrust: 'community',
    externalId: `suggestion:${suggestion.municipalityIbgeCode}:${sha256(normalizedUrl).slice(0, 20)}`,
    eventKind: detected?.kind ?? 'contest_signal',
    municipality: {
      ibgeCode: suggestion.municipalityIbgeCode,
      name: suggestion.municipalityName,
      uf: suggestion.uf,
    },
    title: plainText(suggestion.title, 300),
    excerpt: plainText(suggestion.note, 2_000),
    evidenceUrl: normalizedUrl,
    contentHash,
    contentHashScope: 'discovery_payload',
    publishedOn: suggestion.publishedOn,
    discoveredAt,
    matchedSignals: detected?.signalIds ?? ['manual-suggestion'],
  })
  const result = discoveryStore.appendBatch({ events: [event], recordedAt: discoveredAt })
  return {
    event,
    inserted: result.insertedEvents === 1,
    deduplicated: result.deduplicatedEvents === 1,
  }
}

export {
  PendingDiscoveryStore,
  QueridoDiarioConnector,
  detectHighSignalTerms,
  discoveryEventSchema,
  manualSuggestionSchema,
}
export type {
  DiscoveryEvent,
  DiscoveryEventFilters,
  ManualSuggestion,
  QueridoDiarioQuery,
}
