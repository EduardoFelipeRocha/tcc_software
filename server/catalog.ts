import './env.ts'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  applyCatalogLifecycle,
  buildCatalogMeta,
} from '../src/data/catalog/catalogRules.ts'
import { officialContests } from '../src/data/official/contests.ts'
import type { CatalogSnapshot, Contest, Source } from '../src/entities/contest/types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cacheFile = process.env.CATALOG_CACHE_FILE
  ? resolve(process.env.CATALOG_CACHE_FILE)
  : join(__dirname, 'catalog-cache.json')
const isProduction = process.env.NODE_ENV === 'production'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timestampSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)))
const httpsUrlSchema = z.string().url().max(2_000).refine((value) => {
  const url = new URL(value)
  return url.protocol === 'https:' || (!isProduction && url.hostname === 'localhost')
}, 'A URL precisa usar HTTPS.')
const identifierSchema = z.string().trim().min(1).max(160)
const labelSchema = z.string().trim().min(1).max(500)

const sourceSchema = z.object({
  id: identifierSchema,
  title: labelSchema,
  publisher: labelSchema,
  url: httpsUrlSchema,
  checkedAt: dateSchema,
  official: z.literal(true),
  retrievedAt: timestampSchema,
  contentHash: z.string().regex(/^[a-f\d]{64}$/i),
})

const subjectSchema = z.object({
  id: identifierSchema,
  name: labelSchema,
  historicalWeight: z.number().finite().nonnegative().max(100),
  topics: z.array(z.string().trim().min(1).max(500)).max(500),
})

const studyReferenceSchema = z.object({
  type: z.enum(['current_notice', 'previous_notice', 'official_exam']),
  label: labelSchema,
  url: httpsUrlSchema,
  note: z.string().trim().min(1).max(2_000),
  year: z.number().int().min(1900).max(2200).optional(),
  contentVerifiedAt: dateSchema,
})

const previousEditionSchema = z.object({
  label: labelSchema,
  year: z.number().int().min(1900).max(2200).optional(),
  organizer: labelSchema.optional(),
  fee: labelSchema.optional(),
  note: z.string().trim().min(1).max(2_000),
  examUrl: httpsUrlSchema.optional(),
  examSecondaryUrl: httpsUrlSchema.optional(),
  answerKeyUrl: httpsUrlSchema.optional(),
  answerKeySecondaryUrl: httpsUrlSchema.optional(),
  sourceUrl: httpsUrlSchema.optional(),
})

const contestSchema = z.object({
  id: identifierSchema,
  slug: identifierSchema.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: labelSchema,
  organization: labelSchema,
  acronym: labelSchema,
  governmentLevel: z.enum(['Federal', 'Estadual', 'Municipal']),
  municipalityName: labelSchema.optional(),
  municipalityIbgeCode: z.string().regex(/^\d{7}$/, 'O código IBGE municipal precisa ter 7 dígitos.').optional(),
  uf: z.enum([
    'BR', 'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT',
    'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR',
    'SC', 'SP', 'SE', 'TO',
  ]),
  region: labelSchema,
  scopeLabel: labelSchema,
  area: labelSchema,
  education: z.array(labelSchema).min(1).max(20),
  phase: z.enum([
    'registration_open',
    'notice_published',
    'in_progress',
    'organizer_selected',
    'committee_formed',
    'authorized',
    'expected',
    'closed',
  ]),
  evidence: z.enum(['official_current', 'official_historical']),
  shortDescription: z.string().trim().min(1).max(2_000),
  openingsLabel: labelSchema,
  salaryLabel: labelSchema,
  deadlineLabel: labelSchema,
  feeLabel: labelSchema,
  organizer: labelSchema,
  lastVerified: dateSchema,
  officialUrl: httpsUrlSchema,
  applicationUrl: httpsUrlSchema.optional(),
  registrationStartsAt: dateSchema.optional(),
  registrationEndsAt: dateSchema.optional(),
  featured: z.boolean(),
  sourceIds: z.array(identifierSchema).min(1).max(100),
  studyBasis: z.enum(['official_distribution', 'official_syllabus']).optional(),
  studyReference: studyReferenceSchema.optional(),
  studyUnavailableReason: z.string().trim().min(1).max(2_000).optional(),
  previousEdition: previousEditionSchema,
  subjects: z.array(subjectSchema).max(300),
}).superRefine((contest, context) => {
  const hasMunicipalityName = Boolean(contest.municipalityName)
  const hasMunicipalityIbgeCode = Boolean(contest.municipalityIbgeCode)
  if (hasMunicipalityName !== hasMunicipalityIbgeCode) {
    context.addIssue({
      code: 'custom',
      message: 'Nome e código IBGE do município precisam ser informados juntos.',
    })
  }
  if (contest.governmentLevel === 'Municipal' &&
    (!hasMunicipalityName || !hasMunicipalityIbgeCode)) {
    context.addIssue({
      code: 'custom',
      message: 'Um concurso municipal precisa de nome e código IBGE do município.',
    })
  }
  if (contest.studyReference && (!contest.studyBasis || contest.subjects.length === 0)) {
    context.addIssue({
      code: 'custom',
      message: 'Um plano disponível precisa de base oficial e matérias.',
    })
  }
  if (contest.registrationStartsAt && contest.registrationEndsAt &&
    contest.registrationStartsAt > contest.registrationEndsAt) {
    context.addIssue({ code: 'custom', message: 'A janela de inscrição está invertida.' })
  }
})

const catalogFeedSchema = z.object({
  schemaVersion: z.literal(1),
  provider: z.object({
    id: identifierSchema,
    name: labelSchema,
    homepage: httpsUrlSchema,
  }),
  generatedAt: timestampSchema,
  sources: z.array(sourceSchema).max(50_000),
  contests: z.array(contestSchema).max(20_000),
}).superRefine((feed, context) => {
  const generatedAt = Date.parse(feed.generatedAt)
  const generatedDate = feed.generatedAt.slice(0, 10)
  const sourceIds = new Set<string>()
  const sourcesById = new Map<string, z.infer<typeof sourceSchema>>()
  for (const source of feed.sources) {
    if (sourceIds.has(source.id)) {
      context.addIssue({ code: 'custom', message: `Fonte repetida: ${source.id}` })
    }
    if (source.checkedAt > generatedDate || Date.parse(source.retrievedAt) > generatedAt + 5 * 60 * 1_000) {
      context.addIssue({ code: 'custom', message: `A fonte ${source.id} foi coletada no futuro.` })
    }
    sourceIds.add(source.id)
    sourcesById.set(source.id, source)
  }

  const contestIds = new Set<string>()
  const slugs = new Set<string>()
  for (const contest of feed.contests) {
    if (contestIds.has(contest.id)) {
      context.addIssue({ code: 'custom', message: `Concurso repetido: ${contest.id}` })
    }
    if (slugs.has(contest.slug)) {
      context.addIssue({ code: 'custom', message: `Slug repetido: ${contest.slug}` })
    }
    if (contest.lastVerified > generatedDate) {
      context.addIssue({ code: 'custom', message: `O concurso ${contest.id} foi verificado no futuro.` })
    }
    if (contest.sourceIds.some((sourceId) => !sourceIds.has(sourceId))) {
      context.addIssue({
        code: 'custom',
        message: `O concurso ${contest.id} referencia uma fonte oficial ausente.`,
      })
    }
    if (new Set(contest.sourceIds).size !== contest.sourceIds.length) {
      context.addIssue({ code: 'custom', message: `O concurso ${contest.id} repete fontes.` })
    }

    const linkedSources = contest.sourceIds
      .map((sourceId) => sourcesById.get(sourceId))
      .filter((source): source is z.infer<typeof sourceSchema> => Boolean(source))
    if (linkedSources.length && !linkedSources.some((source) => source.url === contest.officialUrl)) {
      context.addIssue({
        code: 'custom',
        message: `A URL oficial de ${contest.id} não está entre suas evidências.`,
      })
    }
    if (linkedSources.length && !linkedSources.some((source) => source.checkedAt >= contest.lastVerified)) {
      context.addIssue({
        code: 'custom',
        message: `A verificação de ${contest.id} é posterior às evidências coletadas.`,
      })
    }
    contestIds.add(contest.id)
    slugs.add(contest.slug)
  }
})

type CatalogFeed = z.infer<typeof catalogFeedSchema>

export function validateCatalogFeed(value: unknown): CatalogFeed {
  const parsed = catalogFeedSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Feed inválido.')
  }
  return parsed.data
}

export function mergeCatalogFeedHistory(
  previous: CatalogFeed | null,
  incoming: CatalogFeed,
): CatalogFeed {
  if (!previous) return incoming
  if (Date.parse(incoming.generatedAt) < Date.parse(previous.generatedAt)) {
    throw new Error('O feed tentou substituir o catálogo por um snapshot mais antigo.')
  }

  const sources = new Map(previous.sources.map((source) => [source.id, source]))
  incoming.sources.forEach((source) => sources.set(source.id, source))

  const contests = new Map(previous.contests.map((contest) => [contest.id, contest]))
  const idsBySlug = new Map(previous.contests.map((contest) => [contest.slug, contest.id]))
  for (const contest of incoming.contests) {
    const previousIdForSlug = idsBySlug.get(contest.slug)
    if (previousIdForSlug && previousIdForSlug !== contest.id) contests.delete(previousIdForSlug)
    contests.set(contest.id, contest)
    idsBySlug.set(contest.slug, contest.id)
  }

  return validateCatalogFeed({
    ...incoming,
    sources: [...sources.values()],
    contests: [...contests.values()],
  })
}

interface FeedState {
  url: string
  feed: CatalogFeed | null
  lastAttempt: string | null
  lastSuccess: string | null
  error: string | null
  etag?: string
  lastModified?: string
}

const cacheSchema = z.object({
  schemaVersion: z.literal(1),
  savedAt: timestampSchema,
  feeds: z.array(z.object({
    url: httpsUrlSchema,
    feed: catalogFeedSchema,
    lastSuccess: timestampSchema,
    etag: z.string().max(500).optional(),
    lastModified: z.string().max(500).optional(),
  })).max(100),
})

function configuredFeedUrls() {
  const candidates = (process.env.CATALOG_FEED_URLS ?? '')
    .split(/[\n,;]/)
    .map((value) => value.trim())
    .filter(Boolean)

  return [...new Set(candidates)].filter((value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' || (!isProduction && url.hostname === 'localhost')
    } catch {
      console.error('Um feed de catálogo foi ignorado por usar URL inválida ou insegura.')
      return false
    }
  })
}

const feedUrls = configuredFeedUrls()
const requestedInterval = Number(process.env.CATALOG_REFRESH_MINUTES ?? 15)
const refreshIntervalMinutes = Number.isFinite(requestedInterval)
  ? Math.min(24 * 60, Math.max(5, Math.round(requestedInterval)))
  : 15
const refreshIntervalMs = refreshIntervalMinutes * 60 * 1_000
const feeds = new Map<string, FeedState>()
let nextScheduledSync: string | null = null
let refreshInFlight: Promise<void> | null = null

function readCache() {
  if (!existsSync(cacheFile)) return

  try {
    const parsed = cacheSchema.safeParse(
      JSON.parse(readFileSync(cacheFile, 'utf8').replace(/^\uFEFF/, '')) as unknown,
    )
    if (!parsed.success) throw new Error('Formato de cache inválido.')

    for (const cached of parsed.data.feeds) {
      if (!feedUrls.includes(cached.url)) continue
      feeds.set(cached.url, {
        url: cached.url,
        feed: cached.feed,
        lastAttempt: null,
        lastSuccess: cached.lastSuccess,
        error: null,
        etag: cached.etag,
        lastModified: cached.lastModified,
      })
    }
  } catch (error) {
    console.error('O cache do catálogo foi ignorado por estar inválido.', error)
  }
}

function writeCache() {
  const cachedFeeds = [...feeds.values()]
    .filter((state): state is FeedState & { feed: CatalogFeed; lastSuccess: string } =>
      Boolean(state.feed && state.lastSuccess),
    )
    .map((state) => ({
      url: state.url,
      feed: state.feed,
      lastSuccess: state.lastSuccess,
      etag: state.etag,
      lastModified: state.lastModified,
    }))

  if (!cachedFeeds.length) return

  mkdirSync(dirname(cacheFile), { recursive: true })
  const temporaryFile = `${cacheFile}.tmp`
  writeFileSync(temporaryFile, JSON.stringify({
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    feeds: cachedFeeds,
  }, null, 2), 'utf8')
  renameSync(temporaryFile, cacheFile)
}

function mergeContest(base: Contest | undefined, incoming: Contest): Contest {
  if (!base || incoming.studyReference || !base.studyReference) return incoming

  return {
    ...incoming,
    studyBasis: base.studyBasis,
    studyReference: base.studyReference,
    studyUnavailableReason: undefined,
    subjects: base.subjects,
  }
}

function currentContests(now = new Date()) {
  const merged = new Map(officialContests.map((contest) => [contest.id, contest]))
  const slugs = new Map(officialContests.map((contest) => [contest.slug, contest.id]))

  for (const state of feeds.values()) {
    if (!state.feed) continue
    for (const candidate of state.feed.contests) {
      const collidingId = slugs.get(candidate.slug)
      if (collidingId && collidingId !== candidate.id) continue

      const current = merged.get(candidate.id)
      if (current && candidate.lastVerified < current.lastVerified) continue

      const contest = mergeContest(current, candidate as Contest)
      merged.set(contest.id, contest)
      slugs.set(contest.slug, contest.id)
    }
  }

  return [...merged.values()].map((contest) => applyCatalogLifecycle(contest, now))
}

function latestSuccessfulSync() {
  return [...feeds.values()]
    .map((state) => state.lastSuccess)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null
}

export function getCatalogSnapshot(now = new Date()): CatalogSnapshot {
  const contests = currentContests(now)
  const states = [...feeds.values()]
  const automaticUpdates = feedUrls.length > 0

  return {
    contests,
    meta: buildCatalogMeta(contests, {
      mode: automaticUpdates ? 'automatic' : 'bundled',
      automaticUpdates,
      configuredFeeds: feedUrls.length,
      healthyFeeds: states.filter((state) => state.feed && !state.error).length,
      failedFeeds: feedUrls.length - states.filter((state) => state.feed && !state.error).length,
      lastSuccessfulSync: latestSuccessfulSync(),
      nextScheduledSync,
      now,
    }),
  }
}

async function fetchFeed(url: string) {
  const current = feeds.get(url) ?? {
    url,
    feed: null,
    lastAttempt: null,
    lastSuccess: null,
    error: null,
  }
  const attemptedAt = new Date().toISOString()
  current.lastAttempt = attemptedAt
  feeds.set(url, current)

  try {
    const headers = new Headers({
      Accept: 'application/json',
      'User-Agent': 'GuiaConcursos-CatalogSync/1.0',
    })
    if (process.env.CATALOG_FEED_BEARER_TOKEN) {
      headers.set('Authorization', `Bearer ${process.env.CATALOG_FEED_BEARER_TOKEN}`)
    }
    if (current.etag) headers.set('If-None-Match', current.etag)
    if (current.lastModified) headers.set('If-Modified-Since', current.lastModified)

    const response = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    })

    if (isProduction && new URL(response.url).protocol !== 'https:') {
      throw new Error('O feed redirecionou para uma conexão não segura.')
    }

    if (response.status === 304 && current.feed) {
      current.lastSuccess = attemptedAt
      current.error = null
      return
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const contentLength = Number(response.headers.get('content-length') ?? 0)
    if (contentLength > 25 * 1024 * 1024) throw new Error('Feed maior que 25 MB.')

    const body = await response.text()
    if (Buffer.byteLength(body, 'utf8') > 25 * 1024 * 1024) {
      throw new Error('Feed maior que 25 MB.')
    }

    const signingSecret = process.env.CATALOG_FEED_HMAC_SECRET
    if (signingSecret) {
      const suppliedSignature = response.headers.get('x-catalog-signature') ?? ''
      const expectedSignature = createHmac('sha256', signingSecret).update(body).digest('hex')
      const supplied = Buffer.from(suppliedSignature.replace(/^sha256=/, ''), 'hex')
      const expected = Buffer.from(expectedSignature, 'hex')
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
        throw new Error('Assinatura HMAC do feed inválida ou ausente.')
      }
    }

    const feed = validateCatalogFeed(JSON.parse(body) as unknown)

    const maximumFutureTime = Date.now() + 5 * 60 * 1_000
    if (Date.parse(feed.generatedAt) > maximumFutureTime) {
      throw new Error('A geração do feed está no futuro.')
    }

    current.feed = mergeCatalogFeedHistory(current.feed, feed)
    current.lastSuccess = attemptedAt
    current.error = null
    current.etag = response.headers.get('etag') ?? undefined
    current.lastModified = response.headers.get('last-modified') ?? undefined
  } catch (error) {
    current.error = error instanceof Error ? error.message : 'Falha desconhecida.'
    const safeUrl = new URL(url)
    safeUrl.username = ''
    safeUrl.password = ''
    safeUrl.search = ''
    safeUrl.hash = ''
    console.error(`Falha ao atualizar o feed de catálogo ${safeUrl.toString()}: ${current.error}`)
  }
}

export function refreshCatalogFeeds() {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    await Promise.all(feedUrls.map(fetchFeed))
    writeCache()
  })().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

export function startCatalogSynchronization() {
  readCache()
  if (!feedUrls.length) return () => undefined

  nextScheduledSync = new Date(Date.now() + refreshIntervalMs).toISOString()
  void refreshCatalogFeeds()

  const timer = setInterval(() => {
    nextScheduledSync = new Date(Date.now() + refreshIntervalMs).toISOString()
    void refreshCatalogFeeds()
  }, refreshIntervalMs)
  timer.unref()

  return () => clearInterval(timer)
}

export function catalogRefreshIsConfigured() {
  return Boolean(process.env.CATALOG_REFRESH_TOKEN && feedUrls.length)
}

export function catalogRefreshTokenIsValid(value: string | undefined) {
  return Boolean(
    process.env.CATALOG_REFRESH_TOKEN &&
    value === `Bearer ${process.env.CATALOG_REFRESH_TOKEN}`,
  )
}

export type { CatalogFeed, Source }
