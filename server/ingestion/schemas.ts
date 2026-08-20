import { z } from 'zod'

const brazilianStateCodes = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
] as const

export const sourceIdSchema = z.string().trim().min(1).max(120)
  .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/)
export const sha256Schema = z.string().regex(/^[a-f\d]{64}$/)
export const ibgeMunicipalityCodeSchema = z.string().regex(/^\d{7}$/)
export const stateCodeSchema = z.enum(brazilianStateCodes)
export const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Data inválida.')
export const timestampSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Horário inválido.')
export const httpsUrlSchema = z.string().url().max(2_000).refine((value) => {
  const url = new URL(value)
  return url.protocol === 'https:' && !url.username && !url.password
}, 'A URL precisa usar HTTPS e não pode conter credenciais.')

export const discoveryEventKindSchema = z.enum([
  'authorization',
  'committee',
  'organizer',
  'notice',
  'registration',
  'rectification',
  'suspension',
  'cancellation',
  'contest_signal',
])

export const discoveryMunicipalitySchema = z.object({
  ibgeCode: ibgeMunicipalityCodeSchema,
  name: z.string().trim().min(1).max(160),
  uf: stateCodeSchema,
}).strict()

export const discoveryEventSchema = z.object({
  schemaVersion: z.literal(1),
  id: sha256Schema,
  deduplicationKey: sha256Schema,
  status: z.literal('pending'),
  requiresOfficialVerification: z.literal(true),
  sourceId: sourceIdSchema,
  sourceTrust: z.enum(['secondary', 'community']),
  externalId: z.string().trim().min(1).max(1_000),
  eventKind: discoveryEventKindSchema,
  municipality: discoveryMunicipalitySchema,
  title: z.string().trim().min(1).max(300),
  excerpt: z.string().trim().min(1).max(5_000),
  evidenceUrl: httpsUrlSchema,
  contentHash: sha256Schema,
  contentHashScope: z.literal('discovery_payload'),
  publishedOn: dateSchema.optional(),
  sourceScrapedAt: timestampSchema.optional(),
  discoveredAt: timestampSchema,
  matchedSignals: z.array(z.string().trim().min(1).max(80)).min(1).max(30),
}).strict()

export const quarantinedDiscoveryItemSchema = z.object({
  schemaVersion: z.literal(1),
  id: sha256Schema,
  sourceId: sourceIdSchema,
  itemIndex: z.number().int().nonnegative(),
  quarantinedAt: timestampSchema,
  reason: z.string().trim().min(1).max(1_000),
  payloadHash: sha256Schema,
  externalIdHint: z.string().trim().min(1).max(300).optional(),
  payloadPreview: z.string().max(500),
}).strict()

export const manualSuggestionSchema = z.object({
  municipalityIbgeCode: ibgeMunicipalityCodeSchema,
  municipalityName: z.string().trim().min(1).max(160),
  uf: stateCodeSchema,
  evidenceUrl: httpsUrlSchema,
  title: z.string().trim().min(4).max(300),
  note: z.string().trim().min(10).max(2_000),
  publishedOn: dateSchema.optional(),
}).strict()

export type DiscoveryEvent = z.infer<typeof discoveryEventSchema>
export type DiscoveryEventKind = z.infer<typeof discoveryEventKindSchema>
export type DiscoveryMunicipality = z.infer<typeof discoveryMunicipalitySchema>
export type ManualSuggestion = z.infer<typeof manualSuggestionSchema>
export type QuarantinedDiscoveryItem = z.infer<typeof quarantinedDiscoveryItemSchema>
export type StateCode = z.infer<typeof stateCodeSchema>

export interface DiscoveryPage {
  sourceId: string
  requestUrl: string
  requestedAt: string
  totalAvailable: number
  offset: number
  receivedItems: number
  ignoredWithoutSignal: number
  duplicatesInPage: number
  nextOffset: number | null
  events: DiscoveryEvent[]
  quarantined: QuarantinedDiscoveryItem[]
}
