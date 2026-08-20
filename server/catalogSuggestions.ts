import './env.ts'
import { createHash, randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const __dirname = dirname(fileURLToPath(import.meta.url))
const defaultFile = process.env.CATALOG_SUGGESTIONS_FILE
  ? resolve(process.env.CATALOG_SUGGESTIONS_FILE)
  : join(__dirname, 'catalog-suggestions.ndjson')

const ufSchema = z.enum([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
])

const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().default('')

export const catalogSuggestionInputSchema = z.object({
  contestName: z.string().trim().min(2).max(160),
  organization: z.string().trim().min(2).max(160),
  municipality: optionalText(100),
  uf: ufSchema,
  officialUrl: z.union([
    z.literal(''),
    z.string().trim().max(2_000).refine((value) => {
      try {
        return new URL(value).protocol === 'https:'
      } catch {
        return false
      }
    }, { message: 'Informe um link HTTPS válido.' }),
  ]).optional().default(''),
  details: optionalText(1_000),
  website: optionalText(200),
})

const suggestionRecordSchema = z.object({
  id: z.string().uuid(),
  protocol: z.string().regex(/^GC-\d{8}-[A-F0-9]{8}$/),
  fingerprint: z.string().regex(/^[a-f\d]{64}$/),
  contestName: z.string().min(2).max(160),
  organization: z.string().min(2).max(160),
  municipality: z.string().max(100),
  uf: ufSchema,
  officialUrl: z.string().max(2_000),
  details: z.string().max(1_000),
  status: z.enum(['pending', 'approved', 'rejected']),
  createdAt: z.string().datetime(),
})

export type CatalogSuggestionInput = z.input<typeof catalogSuggestionInputSchema>
export type CatalogSuggestionRecord = z.infer<typeof suggestionRecordSchema>

function normalized(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()
}

function suggestionFingerprint(input: z.output<typeof catalogSuggestionInputSchema>) {
  return createHash('sha256').update(JSON.stringify({
    contestName: normalized(input.contestName),
    organization: normalized(input.organization),
    municipality: normalized(input.municipality),
    uf: input.uf,
    officialUrl: input.officialUrl.trim().replace(/\/$/, ''),
    details: normalized(input.details),
  })).digest('hex')
}

function protocolFor(fingerprint: string, createdAt: string) {
  const date = createdAt.slice(0, 10).replaceAll('-', '')
  return `GC-${date}-${fingerprint.slice(0, 8).toUpperCase()}`
}

export class CatalogSuggestionStore {
  readonly #suggestionsByFingerprint = new Map<string, CatalogSuggestionRecord>()
  #storageError: string | null = null

  constructor(private readonly filePath = defaultFile) {
    this.load()
  }

  private load() {
    if (!existsSync(this.filePath)) return

    try {
      const lines = readFileSync(this.filePath, 'utf8')
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .filter((line) => line.trim())
      lines.forEach((line, index) => {
        const parsed = suggestionRecordSchema.safeParse(JSON.parse(line) as unknown)
        if (!parsed.success) throw new Error(`Registro inválido na linha ${index + 1}.`)
        this.#suggestionsByFingerprint.set(parsed.data.fingerprint, parsed.data)
      })
    } catch (error) {
      this.#storageError = error instanceof Error ? error.message : 'Falha de leitura.'
      console.error('O arquivo de indicações do catálogo está inválido; novas escritas foram bloqueadas.', error)
    }
  }

  private append(suggestion: CatalogSuggestionRecord) {
    if (this.#storageError) {
      throw new Error(`Armazenamento de indicações indisponível: ${this.#storageError}`)
    }
    mkdirSync(dirname(this.filePath), { recursive: true })
    appendFileSync(this.filePath, `${JSON.stringify(suggestion)}\n`, 'utf8')
    this.#suggestionsByFingerprint.set(suggestion.fingerprint, suggestion)
  }

  submit(value: unknown, now = new Date()) {
    const input = catalogSuggestionInputSchema.parse(value)
    const fingerprint = suggestionFingerprint(input)
    const createdAt = now.toISOString()
    const protocol = protocolFor(fingerprint, createdAt)

    // Campo invisível preenchido indica automação. A resposta continua neutra para não ensinar o bot.
    if (input.website) return { protocol, duplicate: false, stored: false }

    const existing = this.#suggestionsByFingerprint.get(fingerprint)
    if (existing) return { protocol: existing.protocol, duplicate: true, stored: true }

    const suggestion: CatalogSuggestionRecord = {
      id: randomUUID(),
      protocol,
      fingerprint,
      contestName: input.contestName,
      organization: input.organization,
      municipality: input.municipality,
      uf: input.uf,
      officialUrl: input.officialUrl,
      details: input.details,
      status: 'pending',
      createdAt,
    }

    this.append(suggestion)
    return { protocol, duplicate: false, stored: true }
  }

  metrics() {
    const suggestions = [...this.#suggestionsByFingerprint.values()]
    return {
      total: suggestions.length,
      pending: suggestions.filter((suggestion) => suggestion.status === 'pending').length,
      storageHealthy: !this.#storageError,
    }
  }

  list(limit = 100) {
    const parsedLimit = z.number().int().min(1).max(1_000).parse(limit)
    return [...this.#suggestionsByFingerprint.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, parsedLimit)
      .map((suggestion) => structuredClone(suggestion))
  }
}

export const catalogSuggestionStore = new CatalogSuggestionStore()
