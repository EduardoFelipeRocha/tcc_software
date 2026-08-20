import { z } from 'zod'
import {
  dateSchema,
  discoveryEventSchema,
  type DiscoveryEvent,
  type DiscoveryPage,
  httpsUrlSchema,
  ibgeMunicipalityCodeSchema,
  quarantinedDiscoveryItemSchema,
  type QuarantinedDiscoveryItem,
  stateCodeSchema,
  timestampSchema,
} from './schemas.ts'
import { detectHighSignalTerms, queridoDiarioHighSignalQuery } from './signals.ts'
import { boundedPreview, plainText, serializeForHash, sha256 } from './utils.ts'

export const QUERIDO_DIARIO_SOURCE_ID = 'querido-diario'
const defaultBaseUrl = 'https://api.queridodiario.ok.org.br/'
const defaultAllowedHosts = ['api.queridodiario.ok.org.br']

const editionSchema = z.union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((value) => value === null || value === undefined ? '' : String(value))

// A API pública usa horário UTC sem sufixo e com microssegundos em `scraped_at`.
// Normalizamos para ISO antes de gravar o evento interno.
const queridoDiarioTimestampSchema = z.string().trim().refine((value) => {
  const candidate = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
  return !Number.isNaN(Date.parse(candidate))
}, 'Horário inválido.').transform((value) => {
  const candidate = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
  return new Date(candidate).toISOString()
})

const queridoDiarioItemSchema = z.object({
  territory_id: ibgeMunicipalityCodeSchema,
  territory_name: z.string().trim().min(1).max(160),
  state_code: stateCodeSchema,
  date: dateSchema,
  edition: editionSchema,
  is_extra_edition: z.boolean().optional().default(false),
  url: httpsUrlSchema,
  txt_url: httpsUrlSchema.optional(),
  excerpts: z.array(z.string().max(20_000)).max(30).optional().default([]),
  excerpt: z.string().max(20_000).optional(),
  highlight_texts: z.array(z.string().max(20_000)).max(30).optional().default([]),
  scraped_at: queridoDiarioTimestampSchema.optional(),
}).passthrough()

const queridoDiarioEnvelopeSchema = z.object({
  total_gazettes: z.number().int().nonnegative(),
  gazettes: z.array(z.unknown()).max(1_000),
}).passthrough()

const querySchema = z.object({
  territoryIds: z.array(ibgeMunicipalityCodeSchema).max(100).optional(),
  publishedSince: dateSchema.optional(),
  publishedUntil: dateSchema.optional(),
  scrapedSince: timestampSchema.optional(),
  offset: z.number().int().nonnegative().max(10_000_000).optional().default(0),
  size: z.number().int().min(1).max(100).optional().default(100),
}).strict().superRefine((value, context) => {
  if (value.publishedSince && value.publishedUntil && value.publishedSince > value.publishedUntil) {
    context.addIssue({ code: 'custom', message: 'O período de publicação está invertido.' })
  }
})

export type QueridoDiarioQuery = z.input<typeof querySchema>

export interface QueridoDiarioConnectorOptions {
  baseUrl?: string
  allowedHosts?: readonly string[]
  timeoutMs?: number
  maximumBodyBytes?: number
  fetchImplementation?: typeof fetch
  clock?: () => Date
}

function validatedBoundedInteger(value: number | undefined, fallback: number, minimum: number, maximum: number) {
  if (value === undefined) return fallback
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`O valor precisa estar entre ${minimum} e ${maximum}.`)
  }
  return value
}

function assertAllowedHttpsUrl(value: string, allowedHosts: Set<string>) {
  const url = new URL(value)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !allowedHosts.has(url.hostname.toLocaleLowerCase('en-US'))
  ) {
    throw new Error('A origem do Querido Diário não está na allowlist HTTPS.')
  }
  return url
}

async function readBodyWithinLimit(response: Response, maximumBodyBytes: number) {
  const announcedLength = Number(response.headers.get('content-length') ?? 0)
  if (Number.isFinite(announcedLength) && announcedLength > maximumBodyBytes) {
    throw new Error('A resposta do Querido Diário excede o limite permitido.')
  }

  if (!response.body) {
    const body = new Uint8Array(await response.arrayBuffer())
    if (body.byteLength > maximumBodyBytes) {
      throw new Error('A resposta do Querido Diário excede o limite permitido.')
    }
    return new TextDecoder().decode(body)
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let receivedBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    receivedBytes += value.byteLength
    if (receivedBytes > maximumBodyBytes) {
      await reader.cancel()
      throw new Error('A resposta do Querido Diário excede o limite permitido.')
    }
    chunks.push(value)
  }

  const body = new Uint8Array(receivedBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}

function issueMessage(error: z.ZodError) {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'item'}: ${issue.message}`)
    .join('; ')
    .slice(0, 1_000)
}

function externalIdHint(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const territory = typeof record.territory_id === 'string' ? record.territory_id : ''
  const date = typeof record.date === 'string' ? record.date : ''
  const edition = typeof record.edition === 'string' || typeof record.edition === 'number'
    ? String(record.edition)
    : ''
  const hint = [territory, date, edition].filter(Boolean).join(':')
  return hint ? hint.slice(0, 300) : undefined
}

function quarantineItem(
  value: unknown,
  itemIndex: number,
  quarantinedAt: string,
  reason: string,
): QuarantinedDiscoveryItem {
  const serialized = serializeForHash(value)
  const payloadHash = sha256(serialized)
  return quarantinedDiscoveryItemSchema.parse({
    schemaVersion: 1,
    id: sha256(`${QUERIDO_DIARIO_SOURCE_ID}\u0000${payloadHash}\u0000${reason}`),
    sourceId: QUERIDO_DIARIO_SOURCE_ID,
    itemIndex,
    quarantinedAt,
    reason,
    payloadHash,
    externalIdHint: externalIdHint(value),
    payloadPreview: boundedPreview(value),
  })
}

function titleFor(kind: DiscoveryEvent['eventKind'], municipalityName: string) {
  const labels: Record<DiscoveryEvent['eventKind'], string> = {
    authorization: 'Possível autorização de concurso',
    committee: 'Possível comissão de concurso',
    organizer: 'Possível definição de banca',
    notice: 'Possível edital de concurso',
    registration: 'Possível mudança nas inscrições',
    rectification: 'Possível retificação de concurso',
    suspension: 'Possível suspensão de concurso',
    cancellation: 'Possível cancelamento de concurso',
    contest_signal: 'Possível ato relacionado a concurso',
  }
  return `${labels[kind]} — ${municipalityName}`
}

function eventFromItem(
  item: z.output<typeof queridoDiarioItemSchema>,
  discoveredAt: string,
): DiscoveryEvent | null {
  const excerptParts = [
    ...item.excerpts,
    ...(item.excerpt ? [item.excerpt] : []),
    ...item.highlight_texts,
  ]
  const excerpt = plainText([...new Set(excerptParts)].join(' '), 5_000)
  if (!excerpt) return null

  const detected = detectHighSignalTerms(excerpt)
  if (!detected) return null

  const evidencePayload = {
    territoryId: item.territory_id,
    territoryName: item.territory_name,
    stateCode: item.state_code,
    date: item.date,
    edition: item.edition,
    isExtraEdition: item.is_extra_edition,
    url: item.url,
    excerpt,
  }
  const contentHash = sha256(serializeForHash(evidencePayload))
  const externalId = [
    'gazette',
    item.territory_id,
    item.date,
    item.edition || 'sem-edicao',
    item.is_extra_edition ? 'extra' : 'regular',
    sha256(item.url).slice(0, 16),
  ].join(':')
  const deduplicationKey = sha256(
    `${QUERIDO_DIARIO_SOURCE_ID}\u0000${externalId}\u0000${contentHash}`,
  )

  return discoveryEventSchema.parse({
    schemaVersion: 1,
    id: deduplicationKey,
    deduplicationKey,
    status: 'pending',
    requiresOfficialVerification: true,
    sourceId: QUERIDO_DIARIO_SOURCE_ID,
    sourceTrust: 'secondary',
    externalId,
    eventKind: detected.kind,
    municipality: {
      ibgeCode: item.territory_id,
      name: item.territory_name,
      uf: item.state_code,
    },
    title: titleFor(detected.kind, item.territory_name),
    excerpt,
    evidenceUrl: item.url,
    contentHash,
    contentHashScope: 'discovery_payload',
    publishedOn: item.date,
    sourceScrapedAt: item.scraped_at,
    discoveredAt,
    matchedSignals: detected.signalIds,
  })
}

export class QueridoDiarioConnector {
  readonly #baseUrl: URL
  readonly #allowedHosts: Set<string>
  readonly #timeoutMs: number
  readonly #maximumBodyBytes: number
  readonly #fetchImplementation: typeof fetch
  readonly #clock: () => Date

  constructor(options: QueridoDiarioConnectorOptions = {}) {
    this.#allowedHosts = new Set(
      (options.allowedHosts ?? defaultAllowedHosts)
        .map((host) => host.trim().toLocaleLowerCase('en-US'))
        .filter(Boolean),
    )
    if (!this.#allowedHosts.size) throw new Error('A allowlist do conector não pode estar vazia.')
    this.#baseUrl = assertAllowedHttpsUrl(options.baseUrl ?? defaultBaseUrl, this.#allowedHosts)
    if (!this.#baseUrl.pathname.endsWith('/')) this.#baseUrl.pathname += '/'
    this.#timeoutMs = validatedBoundedInteger(options.timeoutMs, 15_000, 500, 30_000)
    this.#maximumBodyBytes = validatedBoundedInteger(
      options.maximumBodyBytes,
      5 * 1024 * 1024,
      1_024,
      25 * 1024 * 1024,
    )
    this.#fetchImplementation = options.fetchImplementation ?? globalThis.fetch
    this.#clock = options.clock ?? (() => new Date())
  }

  buildRequestUrl(query: QueridoDiarioQuery = {}) {
    const parsed = querySchema.parse(query)
    const url = new URL('gazettes', this.#baseUrl)
    for (const territoryId of [...new Set(parsed.territoryIds ?? [])]) {
      url.searchParams.append('territory_ids', territoryId)
    }
    if (parsed.publishedSince) url.searchParams.set('published_since', parsed.publishedSince)
    if (parsed.publishedUntil) url.searchParams.set('published_until', parsed.publishedUntil)
    if (parsed.scrapedSince) url.searchParams.set('scraped_since', parsed.scrapedSince)
    url.searchParams.set('querystring', queridoDiarioHighSignalQuery)
    url.searchParams.set('excerpt_size', '5000')
    url.searchParams.set('number_of_excerpts', '5')
    url.searchParams.set('pre_tags', '')
    url.searchParams.set('post_tags', '')
    url.searchParams.set('size', String(parsed.size))
    url.searchParams.set('offset', String(parsed.offset))
    url.searchParams.set('sort_by', 'ascending_date')
    return url
  }

  async fetchPage(query: QueridoDiarioQuery = {}): Promise<DiscoveryPage> {
    const parsedQuery = querySchema.parse(query)
    const requestUrl = this.buildRequestUrl(parsedQuery)
    const requestedAt = this.#clock().toISOString()
    timestampSchema.parse(requestedAt)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs)

    let response: Response
    try {
      response = await this.#fetchImplementation(requestUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'GuiaConcursos-DiscoveryRadar/1.0',
        },
        redirect: 'manual',
        signal: controller.signal,
      })
      if (response.status >= 300 && response.status < 400) {
        throw new Error('O conector recusou um redirecionamento da fonte.')
      }
      if (!response.ok) {
        throw new Error(`Querido Diário respondeu com HTTP ${response.status}.`)
      }
      if (response.url) assertAllowedHttpsUrl(response.url, this.#allowedHosts)

      const contentType = response.headers.get('content-type')?.toLocaleLowerCase('en-US') ?? ''
      if (!contentType.includes('application/json') && !contentType.includes('+json')) {
        throw new Error('O Querido Diário retornou um tipo de conteúdo inesperado.')
      }

      const body = await readBodyWithinLimit(response, this.#maximumBodyBytes)
      let decoded: unknown
      try {
        decoded = JSON.parse(body) as unknown
      } catch {
        throw new Error('O Querido Diário retornou JSON inválido.')
      }
      return this.#pageFromDecoded(decoded, parsedQuery, requestUrl, requestedAt)
    } finally {
      clearTimeout(timeout)
    }
  }

  #pageFromDecoded(
    decoded: unknown,
    parsedQuery: z.output<typeof querySchema>,
    requestUrl: URL,
    requestedAt: string,
  ): DiscoveryPage {
    const envelope = queridoDiarioEnvelopeSchema.parse(decoded)

    const events = new Map<string, DiscoveryEvent>()
    const quarantined: QuarantinedDiscoveryItem[] = []
    let ignoredWithoutSignal = 0
    let duplicatesInPage = 0

    envelope.gazettes.forEach((candidate, itemIndex) => {
      const parsedItem = queridoDiarioItemSchema.safeParse(candidate)
      if (!parsedItem.success) {
        quarantined.push(quarantineItem(
          candidate,
          itemIndex,
          requestedAt,
          issueMessage(parsedItem.error),
        ))
        return
      }

      const event = eventFromItem(parsedItem.data, requestedAt)
      if (!event) {
        ignoredWithoutSignal += 1
        return
      }
      if (events.has(event.deduplicationKey)) {
        duplicatesInPage += 1
        return
      }
      events.set(event.deduplicationKey, event)
    })

    const nextOffset = parsedQuery.offset + envelope.gazettes.length < envelope.total_gazettes
      ? parsedQuery.offset + envelope.gazettes.length
      : null

    return {
      sourceId: QUERIDO_DIARIO_SOURCE_ID,
      requestUrl: requestUrl.toString(),
      requestedAt,
      totalAvailable: envelope.total_gazettes,
      offset: parsedQuery.offset,
      receivedItems: envelope.gazettes.length,
      ignoredWithoutSignal,
      duplicatesInPage,
      nextOffset,
      events: [...events.values()],
      quarantined,
    }
  }
}
