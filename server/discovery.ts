import './env.ts'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getDiscoveryHealth,
  listDiscoveryEvents,
  PendingDiscoveryStore,
  startDiscoverySynchronization,
  type DiscoveryEventFilters,
  type DiscoverySynchronizationHandle,
} from './ingestion/index.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isTest = process.env.NODE_ENV === 'test'

function boundedEnvironmentInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    console.error(`${name} foi ignorada: use um inteiro entre ${minimum} e ${maximum}.`)
    return fallback
  }
  return parsed
}

const enabled = !isTest && process.env.CATALOG_DISCOVERY_ENABLED !== 'false'
const intervalMinutes = boundedEnvironmentInteger(
  'CATALOG_DISCOVERY_REFRESH_MINUTES',
  60,
  5,
  24 * 60,
)
const lookbackDays = boundedEnvironmentInteger('CATALOG_DISCOVERY_LOOKBACK_DAYS', 30, 1, 365)
const maximumPagesPerRun = boundedEnvironmentInteger(
  'CATALOG_DISCOVERY_MAX_PAGES_PER_RUN',
  5,
  1,
  60,
)
const logFile = process.env.CATALOG_DISCOVERY_LOG_FILE
  ? resolve(process.env.CATALOG_DISCOVERY_LOG_FILE)
  : join(__dirname, 'discovery-events.ndjson')

let handle: DiscoverySynchronizationHandle | null = null
let configurationError: string | null = null

function publishedSince() {
  return new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 10)
}

export function startCatalogDiscovery() {
  if (handle) return handle

  try {
    const store = new PendingDiscoveryStore(enabled ? { logFile } : {})
    handle = startDiscoverySynchronization({
      enabled,
      store,
      intervalMinutes,
      maximumPagesPerRun,
      query: {
        publishedSince: publishedSince(),
        size: 100,
      },
      runImmediately: true,
      onError(error) {
        console.error(`Falha no radar municipal: ${error.message}`)
      },
    })
  } catch (error) {
    configurationError = error instanceof Error ? error.message : 'Falha de configuração.'
    console.error('O radar municipal não pôde ser iniciado.', error)
    handle = startDiscoverySynchronization({ enabled: false })
  }

  return handle
}

export function refreshCatalogDiscovery() {
  if (!enabled) return Promise.reject(new Error('O radar municipal não está habilitado.'))
  return (handle ?? startCatalogDiscovery()).runNow()
}

export function getCatalogDiscoveryHealth() {
  const health = getDiscoveryHealth()
  return {
    ...health,
    status: configurationError ? 'degraded' as const : health.status,
    enabled: enabled && !configurationError,
    sourceName: 'Querido Diário',
    coverageStatement: 'Radar complementar de diários municipais disponíveis; não representa os 5.570 municípios.',
    lookbackDays,
    maximumPagesPerRun,
    configurationError,
  }
}

export function getCatalogDiscoveryEvents(filters: DiscoveryEventFilters = {}) {
  return listDiscoveryEvents(filters)
}

export function catalogDiscoveryRefreshIsConfigured() {
  return Boolean(enabled && process.env.CATALOG_REFRESH_TOKEN)
}

export function catalogReviewTokenIsValid(value: string | undefined) {
  return Boolean(
    process.env.CATALOG_REVIEW_TOKEN &&
    value === `Bearer ${process.env.CATALOG_REVIEW_TOKEN}`,
  )
}
