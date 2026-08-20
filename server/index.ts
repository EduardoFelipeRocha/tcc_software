import './env.ts'
import cookieParser from 'cookie-parser'
import express from 'express'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  catalogRefreshIsConfigured,
  catalogRefreshTokenIsValid,
  getCatalogSnapshot,
  refreshCatalogFeeds,
  startCatalogSynchronization,
} from './catalog.ts'
import { catalogSuggestionStore } from './catalogSuggestions.ts'
import {
  catalogDiscoveryRefreshIsConfigured,
  catalogReviewTokenIsValid,
  getCatalogDiscoveryEvents,
  getCatalogDiscoveryHealth,
  refreshCatalogDiscovery,
  startCatalogDiscovery,
} from './discovery.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDirectory = join(__dirname, '..')
const dataFile = process.env.DATA_FILE ? resolve(process.env.DATA_FILE) : join(__dirname, 'data.json')
const port = Number(process.env.PORT ?? 3333)
const isProduction = process.env.NODE_ENV === 'production'
const servesStaticFiles = isProduction || process.env.SERVE_STATIC === 'true'

const identifierSchema = z.string().trim().min(1).max(160)
const labelSchema = z.string().trim().min(1).max(300)
const timestampSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)))
const avatarPresetSchema = z.enum([
  'homem-verde',
  'homem-azul',
  'homem-ambar',
  'mulher-verde',
  'mulher-violeta',
  'mulher-coral',
])

function hasValidImageSignature(value: string) {
  const [header, payload] = value.split(',', 2)
  if (!header || !payload) return false
  const bytes = Buffer.from(payload, 'base64')
  if (header === 'data:image/jpeg;base64') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (header === 'data:image/png;base64') {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  if (header === 'data:image/webp;base64') {
    return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  }
  return false
}

const uploadedAvatarSchema = z.string()
  .max(180_000)
  .regex(
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
    'A foto precisa ser JPEG, PNG ou WebP.',
  )
  .refine((value) => {
    const payload = value.slice(value.indexOf(',') + 1)
    return Buffer.byteLength(payload, 'base64') <= 128 * 1024
  }, 'A foto processada deve ter no máximo 128 KB.')
  .refine(hasValidImageSignature, 'O conteúdo da foto não corresponde ao formato informado.')
const profileAvatarSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('preset'), preset: avatarPresetSchema }),
  z.object({ type: z.literal('upload'), dataUrl: uploadedAvatarSchema }),
])
const sessionKindSchema = z.enum([
  'Teoria + resumo',
  'Quest\u00f5es',
  'Revis\u00e3o ativa',
])

const studySessionSchema = z.object({
  id: identifierSchema,
  weekday: z.string().trim().min(1).max(16),
  subjectId: identifierSchema,
  subjectName: labelSchema,
  topic: z.string().trim().min(1).max(500),
  minutes: z.number().int().min(1).max(24 * 60),
  kind: sessionKindSchema,
})

const planSubjectSchema = z.object({
  id: identifierSchema,
  name: labelSchema,
  topics: z.array(z.string().trim().min(1).max(500)).max(500),
  priority: z.number().finite().nonnegative().max(1_000_000),
  sessionCount: z.number().int().nonnegative().max(1000),
  totalMinutes: z.number().int().nonnegative().max(7 * 24 * 60),
})

const studyPlanSchema = z
  .object({
    version: z.literal(1),
    algorithmVersion: z.string().trim().min(1).max(40),
    contestId: identifierSchema,
    contestSlug: identifierSchema,
    contestTitle: labelSchema,
    organization: labelSchema,
    referenceLabel: labelSchema,
    referenceType: z.enum(['current_notice', 'previous_notice', 'official_exam', 'legacy_unverified']).default('legacy_unverified'),
    referenceUrl: z.union([z.string().url().max(2000), z.literal('')]).default(''),
    referenceNote: z.string().trim().min(1).max(2000).default('Plano migrado da versão anterior.'),
    referenceYear: z.number().int().min(1900).max(2200).optional(),
    previousEditionLabel: z.string().trim().min(1).max(300).optional(),
    previousEditionUrl: z.string().url().max(2000).optional(),
    previousEditionYear: z.number().int().min(1900).max(2200).optional(),
    previousEditionNote: z.string().trim().min(1).max(2000).optional(),
    weightingBasis: z.enum(['official_distribution', 'balanced_syllabus']).default('balanced_syllabus'),
    generatedAt: timestampSchema,
    hoursPerWeek: z.number().finite().positive().max(7 * 24),
    weekdays: z.array(z.string().trim().min(1).max(16)).min(1).max(7),
    sessions: z.array(studySessionSchema).min(1).max(1000),
    subjects: z.array(planSubjectSchema).min(1).max(300),
  })
  .superRefine((plan, context) => {
    const weekdays = new Set(plan.weekdays)
    if (weekdays.size !== plan.weekdays.length) {
      context.addIssue({ code: 'custom', message: 'Os dias do plano devem ser únicos.' })
    }

    const subjectIds = new Set<string>()
    for (const subject of plan.subjects) {
      if (subjectIds.has(subject.id)) {
        context.addIssue({ code: 'custom', message: 'As matérias do plano devem ser únicas.' })
      }
      subjectIds.add(subject.id)
    }

    const sessionIds = new Set<string>()
    for (const session of plan.sessions) {
      if (sessionIds.has(session.id)) {
        context.addIssue({ code: 'custom', message: 'As sessões do plano devem ser únicas.' })
      }
      sessionIds.add(session.id)

      if (!weekdays.has(session.weekday)) {
        context.addIssue({ code: 'custom', message: 'Uma sessão usa um dia fora do plano.' })
      }
      if (!subjectIds.has(session.subjectId)) {
        context.addIssue({ code: 'custom', message: 'Uma sessão usa uma matéria inexistente.' })
      }
    }

    for (const subject of plan.subjects) {
      const subjectSessions = plan.sessions.filter((session) => session.subjectId === subject.id)
      const subjectMinutes = subjectSessions.reduce((total, session) => total + session.minutes, 0)
      if (
        subject.sessionCount !== subjectSessions.length ||
        subject.totalMinutes !== subjectMinutes
      ) {
        context.addIssue({ code: 'custom', message: 'O resumo das matérias não corresponde às sessões.' })
      }
    }

    const plannedMinutes = plan.sessions.reduce((total, session) => total + session.minutes, 0)
    if (plannedMinutes !== Math.round(plan.hoursPerWeek * 60)) {
      context.addIssue({ code: 'custom', message: 'A duração das sessões não corresponde à carga semanal.' })
    }
  })

const studyPayloadSchema = z
  .object({
    plan: studyPlanSchema,
    completedSessionIds: z.array(identifierSchema).max(1000),
  })
  .superRefine(({ plan, completedSessionIds }, context) => {
    const validSessionIds = new Set(plan.sessions.map((session) => session.id))
    const uniqueCompletedIds = new Set(completedSessionIds)

    if (uniqueCompletedIds.size !== completedSessionIds.length) {
      context.addIssue({ code: 'custom', message: 'O progresso contém sessões repetidas.' })
    }
    if (completedSessionIds.some((sessionId) => !validSessionIds.has(sessionId))) {
      context.addIssue({ code: 'custom', message: 'O progresso contém uma sessão inexistente.' })
    }
  })

const storedUserSchema = z.object({
  id: identifierSchema,
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  passwordHash: z.string().regex(/^[a-f\d]{128}$/i),
  passwordSalt: z.string().regex(/^[a-f\d]{32}$/i),
  createdAt: z.unknown().optional(),
  avatar: profileAvatarSchema.nullable().optional().catch(null),
})

const storedSessionSchema = z.object({
  token: z.string().regex(/^[a-f\d]{64}$/i),
  userId: identifierSchema,
  expiresAt: timestampSchema,
})

interface UserRecord {
  id: string
  name: string
  email: string
  passwordHash: string
  passwordSalt: string
  createdAt: string
  avatar: z.infer<typeof profileAvatarSchema> | null
}

interface SessionRecord {
  token: string
  userId: string
  expiresAt: string
}

interface StudyRecord {
  plan: z.infer<typeof studyPlanSchema>
  completedSessionIds: string[]
  updatedAt: string
}

interface StudyLibraryRecord {
  version: 1
  activePlanId: string | null
  plans: StudyRecord[]
  updatedAt: string
}

interface DatabaseShape {
  users: UserRecord[]
  sessions: SessionRecord[]
  studies: Record<string, StudyLibraryRecord>
}

const emptyDatabase: DatabaseShape = { users: [], sessions: [], studies: {} }
let databaseReadFailed = false

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function prepareLegacyPlan(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.sessions)) return value

  const sessions = value.sessions.map((candidate) => {
    if (!isRecord(candidate)) return candidate
    const topic = typeof candidate.topic === 'string' && candidate.topic.trim()
      ? candidate.topic
      : 'Revisão geral da disciplina'
    return { ...candidate, topic }
  })

  if (Array.isArray(value.subjects) && value.subjects.length > 0) {
    return { ...value, sessions }
  }

  const summaries = new Map<string, {
    id: string
    name: string
    topics: string[]
    priority: number
    sessionCount: number
    totalMinutes: number
  }>()

  for (const candidate of sessions) {
    if (!isRecord(candidate)) continue
    if (
      typeof candidate.subjectId !== 'string' || !candidate.subjectId.trim() ||
      typeof candidate.subjectName !== 'string' || !candidate.subjectName.trim() ||
      typeof candidate.topic !== 'string' || !candidate.topic.trim() ||
      typeof candidate.minutes !== 'number' || !Number.isFinite(candidate.minutes)
    ) continue

    const current = summaries.get(candidate.subjectId) ?? {
      id: candidate.subjectId,
      name: candidate.subjectName,
      topics: [],
      priority: 0,
      sessionCount: 0,
      totalMinutes: 0,
    }
    current.sessionCount += 1
    current.totalMinutes += Math.round(candidate.minutes)
    if (!current.topics.includes(candidate.topic)) current.topics.push(candidate.topic)
    summaries.set(candidate.subjectId, current)
  }

  const priority = summaries.size ? Number((100 / summaries.size).toFixed(2)) : 0
  const subjects = [...summaries.values()].map((summary) => ({ ...summary, priority }))
  return { ...value, sessions, subjects }
}

function normalizeStudyRecord(value: unknown): StudyRecord | null {
  if (!isRecord(value)) return null

  const parsedPlan = studyPlanSchema.safeParse(prepareLegacyPlan(value.plan))
  if (!parsedPlan.success) return null

  const validSessionIds = new Set(parsedPlan.data.sessions.map((session) => session.id))
  const completedSessionIds = Array.isArray(value.completedSessionIds)
    ? [...new Set(
        value.completedSessionIds.filter(
          (sessionId): sessionId is string =>
            typeof sessionId === 'string' &&
            sessionId.length <= 160 &&
            validSessionIds.has(sessionId),
        ),
      )].slice(0, 1000)
    : []
  const parsedUpdatedAt = timestampSchema.safeParse(value.updatedAt)

  return {
    plan: parsedPlan.data,
    completedSessionIds,
    updatedAt: parsedUpdatedAt.success ? parsedUpdatedAt.data : parsedPlan.data.generatedAt,
  }
}

function normalizeStudyLibrary(value: unknown): StudyLibraryRecord | null {
  if (!isRecord(value)) return null

  if (!Array.isArray(value.plans)) {
    const legacy = normalizeStudyRecord(value)
    if (!legacy) return null
    return {
      version: 1,
      activePlanId: legacy.plan.contestId,
      plans: [legacy],
      updatedAt: legacy.updatedAt,
    }
  }

  const uniquePlans = new Map<string, StudyRecord>()
  for (const candidate of value.plans.slice(0, 100)) {
    const state = normalizeStudyRecord(candidate)
    if (state) uniquePlans.set(state.plan.contestId, state)
  }
  const plans = [...uniquePlans.values()]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
  const requestedActivePlanId = typeof value.activePlanId === 'string' ? value.activePlanId : ''
  const activePlanId = plans.some((state) => state.plan.contestId === requestedActivePlanId)
    ? requestedActivePlanId
    : plans[0]?.plan.contestId ?? null
  const parsedUpdatedAt = timestampSchema.safeParse(value.updatedAt)
  return {
    version: 1,
    activePlanId,
    plans,
    updatedAt: parsedUpdatedAt.success
      ? parsedUpdatedAt.data
      : plans[0]?.updatedAt ?? new Date(0).toISOString(),
  }
}

function normalizeDatabase(value: unknown): DatabaseShape {
  if (!isRecord(value)) return structuredClone(emptyDatabase)

  const users: UserRecord[] = []
  const userIds = new Set<string>()
  const userEmails = new Set<string>()
  const candidates = Array.isArray(value.users) ? value.users : []

  for (const candidate of candidates) {
    const parsed = storedUserSchema.safeParse(candidate)
    if (!parsed.success) continue

    const email = normalizeEmail(parsed.data.email)
    if (userIds.has(parsed.data.id) || userEmails.has(email)) continue

    const parsedCreatedAt = timestampSchema.safeParse(parsed.data.createdAt)

    users.push({
      ...parsed.data,
      email,
      createdAt: parsedCreatedAt.success ? parsedCreatedAt.data : new Date(0).toISOString(),
      avatar: parsed.data.avatar ?? null,
    })
    userIds.add(parsed.data.id)
    userEmails.add(email)
  }

  const sessions: SessionRecord[] = []
  const sessionTokens = new Set<string>()
  const sessionCandidates = Array.isArray(value.sessions) ? value.sessions : []
  for (const candidate of sessionCandidates) {
    const parsed = storedSessionSchema.safeParse(candidate)
    if (
      !parsed.success ||
      !userIds.has(parsed.data.userId) ||
      sessionTokens.has(parsed.data.token)
    ) {
      continue
    }
    sessions.push(parsed.data)
    sessionTokens.add(parsed.data.token)
  }

  const studies: Record<string, StudyLibraryRecord> = {}
  if (isRecord(value.studies)) {
    for (const [userId, candidate] of Object.entries(value.studies)) {
      if (!userIds.has(userId)) continue
      const study = normalizeStudyLibrary(candidate)
      if (study) studies[userId] = study
    }
  }

  return { users, sessions, studies }
}

function readDatabase(): DatabaseShape {
  if (!existsSync(dataFile)) {
    databaseReadFailed = false
    return structuredClone(emptyDatabase)
  }

  try {
    const contents = readFileSync(dataFile, 'utf8').replace(/^\uFEFF/, '')
    const database = normalizeDatabase(JSON.parse(contents) as unknown)
    databaseReadFailed = false
    return database
  } catch (error) {
    databaseReadFailed = true
    console.error('O banco local não pôde ser lido e não será sobrescrito.', error)
    return structuredClone(emptyDatabase)
  }
}

function writeDatabase(database: DatabaseShape) {
  if (databaseReadFailed) {
    throw new Error('O banco local está ilegível. Corrija ou restaure server/data.json antes de salvar.')
  }
  writeFileSync(dataFile, JSON.stringify(normalizeDatabase(database), null, 2), 'utf8')
}

function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase('pt-BR')
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString('hex')
}

function publicUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    avatar: user.avatar,
  }
}

const credentialsSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
})

const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2, 'Informe seu nome.').max(80),
})

const avatarUpdateSchema = z.object({
  avatar: profileAvatarSchema.nullable(),
})

const app = express()
app.disable('x-powered-by')
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0)
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0 && trustProxyHops <= 10) {
  app.set('trust proxy', trustProxyHops)
}
app.use(express.json({ limit: '500kb' }))
app.use(cookieParser())

const suggestionAttempts = new Map<string, number[]>()

function canSubmitCatalogSuggestion(address: string, now = Date.now()) {
  if (suggestionAttempts.size > 10_000) suggestionAttempts.clear()
  const oneHourAgo = now - 60 * 60 * 1_000
  const recent = (suggestionAttempts.get(address) ?? []).filter((time) => time >= oneHourAgo)
  if (recent.length >= 10) return false
  suggestionAttempts.set(address, [...recent, now])
  return true
}

app.get('/api/catalog', (_request, response) => {
  response.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  response.json(getCatalogSnapshot())
})

app.get('/api/catalog/health', (_request, response) => {
  response.set('Cache-Control', 'no-store')
  const snapshot = getCatalogSnapshot()
  const radar = getCatalogDiscoveryHealth()
  const status = snapshot.meta.failedFeeds > 0 || (radar.enabled && radar.status === 'degraded')
    ? 206
    : 200
  response.status(status).json({
    ...snapshot.meta,
    radar,
    suggestions: catalogSuggestionStore.metrics(),
  })
})

app.get('/api/catalog/radar/health', (_request, response) => {
  response.set('Cache-Control', 'no-store')
  const health = getCatalogDiscoveryHealth()
  response.status(health.enabled && health.status === 'degraded' ? 206 : 200).json(health)
})

app.get('/api/catalog/radar/events', (request, response) => {
  if (!catalogReviewTokenIsValid(request.header('authorization'))) {
    response.status(401).json({ message: 'Credencial de revisão inválida.' })
    return
  }

  const singleQueryValue = (value: unknown) => typeof value === 'string' ? value : undefined
  const rawLimit = singleQueryValue(request.query.limit)
  try {
    const events = getCatalogDiscoveryEvents({
      sourceId: singleQueryValue(request.query.sourceId),
      municipalityIbgeCode: singleQueryValue(request.query.municipalityIbgeCode),
      uf: singleQueryValue(request.query.uf) as never,
      eventKind: singleQueryValue(request.query.eventKind) as never,
      discoveredSince: singleQueryValue(request.query.discoveredSince),
      limit: rawLimit ? Number(rawLimit) : undefined,
    })
    response.set('Cache-Control', 'no-store')
    response.json({ events })
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({ message: error.issues[0]?.message ?? 'Filtro inválido.' })
      return
    }
    response.status(400).json({ message: 'Filtros de revisão inválidos.' })
  }
})

app.post('/api/catalog/refresh', async (request, response) => {
  if (!catalogRefreshIsConfigured()) {
    response.status(404).json({ message: 'Atualização externa não configurada.' })
    return
  }
  if (!catalogRefreshTokenIsValid(request.header('authorization'))) {
    response.status(401).json({ message: 'Credencial de atualização inválida.' })
    return
  }

  await refreshCatalogFeeds()
  response.json(getCatalogSnapshot())
})

app.post('/api/catalog/radar/refresh', async (request, response) => {
  if (!catalogDiscoveryRefreshIsConfigured()) {
    response.status(404).json({ message: 'Atualização do radar não configurada.' })
    return
  }
  if (!catalogRefreshTokenIsValid(request.header('authorization'))) {
    response.status(401).json({ message: 'Credencial de atualização inválida.' })
    return
  }

  try {
    const run = await refreshCatalogDiscovery()
    response.json({ run, health: getCatalogDiscoveryHealth() })
  } catch (error) {
    console.error('Falha ao atualizar o radar manualmente.', error)
    response.status(502).json({ message: 'O radar não pôde ser atualizado agora.' })
  }
})

app.post('/api/catalog/suggestions', (request, response) => {
  if (!canSubmitCatalogSuggestion(request.ip ?? 'unknown')) {
    response.status(429).json({ message: 'Muitas indicações em pouco tempo. Tente novamente mais tarde.' })
    return
  }

  try {
    const result = catalogSuggestionStore.submit(request.body)
    response.status(202).json({
      protocol: result.protocol,
      duplicate: result.duplicate,
      message: 'Indicação recebida para conferência.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        message: error.issues[0]?.message ?? 'Revise os dados da indicação.',
      })
      return
    }
    console.error('Falha ao registrar indicação de concurso.', error)
    response.status(500).json({ message: 'Não foi possível registrar a indicação agora.' })
  }
})

app.get('/api/catalog/suggestions', (request, response) => {
  if (!catalogReviewTokenIsValid(request.header('authorization'))) {
    response.status(401).json({ message: 'Credencial de revisão inválida.' })
    return
  }

  const rawLimit = typeof request.query.limit === 'string' ? Number(request.query.limit) : 100
  try {
    response.set('Cache-Control', 'no-store')
    response.json({
      suggestions: catalogSuggestionStore.list(rawLimit),
      metrics: catalogSuggestionStore.metrics(),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({ message: error.issues[0]?.message ?? 'Limite inválido.' })
      return
    }
    response.status(400).json({ message: 'Limite inválido.' })
  }
})

function createSession(userId: string, response: express.Response) {
  const database = readDatabase()
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  database.sessions = database.sessions.filter(
    (session) => new Date(session.expiresAt).getTime() > Date.now(),
  )
  database.sessions.push({ token, userId, expiresAt })
  writeDatabase(database)
  response.cookie('guiaconcursos_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 30,
    path: '/',
  })
}

function authenticatedUser(request: express.Request) {
  const token = request.cookies.guiaconcursos_session as string | undefined
  if (!token) return null
  const database = readDatabase()
  const session = database.sessions.find(
    (candidate) => candidate.token === token && new Date(candidate.expiresAt).getTime() > Date.now(),
  )
  if (!session) return null
  return database.users.find((user) => user.id === session.userId) ?? null
}

app.post('/api/auth/register', (request, response) => {
  const parsed = registerSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const database = readDatabase()
  const email = normalizeEmail(parsed.data.email)
  if (database.users.some((user) => user.email === email)) {
    response.status(409).json({ message: 'Já existe uma conta com este e-mail.' })
    return
  }

  const passwordSalt = randomBytes(16).toString('hex')
  const user: UserRecord = {
    id: randomUUID(),
    name: parsed.data.name.trim(),
    email,
    passwordSalt,
    passwordHash: hashPassword(parsed.data.password, passwordSalt),
    createdAt: new Date().toISOString(),
    avatar: null,
  }
  database.users.push(user)
  writeDatabase(database)
  createSession(user.id, response)
  response.status(201).json({ user: publicUser(user) })
})

app.post('/api/auth/login', (request, response) => {
  const parsed = credentialsSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const database = readDatabase()
  const user = database.users.find((candidate) => candidate.email === normalizeEmail(parsed.data.email))
  if (!user) {
    response.status(401).json({ message: 'E-mail ou senha incorretos.' })
    return
  }

  const suppliedHash = Buffer.from(hashPassword(parsed.data.password, user.passwordSalt), 'hex')
  const storedHash = Buffer.from(user.passwordHash, 'hex')
  if (suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) {
    response.status(401).json({ message: 'E-mail ou senha incorretos.' })
    return
  }

  createSession(user.id, response)
  response.json({ user: publicUser(user) })
})

app.get('/api/auth/session', (request, response) => {
  const user = authenticatedUser(request)
  response.json({ user: user ? publicUser(user) : null })
})

app.post('/api/auth/logout', (request, response) => {
  const token = request.cookies.guiaconcursos_session as string | undefined
  const database = readDatabase()
  database.sessions = database.sessions.filter((session) => session.token !== token)
  writeDatabase(database)
  response.clearCookie('guiaconcursos_session', { path: '/' })
  response.status(204).end()
})

app.patch('/api/profile/avatar', (request, response) => {
  const authenticated = authenticatedUser(request)
  if (!authenticated) {
    response.status(401).json({ message: 'Entre na sua conta para atualizar o perfil.' })
    return
  }
  const parsed = avatarUpdateSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Avatar inválido.' })
    return
  }

  const database = readDatabase()
  const user = database.users.find((candidate) => candidate.id === authenticated.id)
  if (!user) {
    response.status(404).json({ message: 'Conta não encontrada.' })
    return
  }
  user.avatar = parsed.data.avatar
  writeDatabase(database)
  response.json({ user: publicUser(user) })
})

app.get('/api/study', (request, response) => {
  const user = authenticatedUser(request)
  if (!user) {
    response.status(401).json({ message: 'Entre na sua conta para acessar o plano.' })
    return
  }
  const database = readDatabase()
  response.json(database.studies[user.id] ?? null)
})

app.put('/api/study', (request, response) => {
  const user = authenticatedUser(request)
  if (!user) {
    response.status(401).json({ message: 'Entre na sua conta para salvar o plano.' })
    return
  }
  const parsed = studyPayloadSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({ message: 'Plano inválido.' })
    return
  }

  const database = readDatabase()
  const currentLibrary = database.studies[user.id] ?? {
    version: 1 as const,
    activePlanId: null,
    plans: [],
    updatedAt: new Date().toISOString(),
  }
  const state: StudyRecord = {
    plan: parsed.data.plan,
    completedSessionIds: parsed.data.completedSessionIds,
    updatedAt: new Date().toISOString(),
  }
  const otherPlans = currentLibrary.plans.filter(
    (candidate) => candidate.plan.contestId !== parsed.data.plan.contestId,
  )
  database.studies[user.id] = {
    version: 1,
    activePlanId: parsed.data.plan.contestId,
    plans: [state, ...otherPlans].slice(0, 100),
    updatedAt: state.updatedAt,
  }
  writeDatabase(database)
  response.json(database.studies[user.id])
})

app.delete('/api/study/:contestId', (request, response) => {
  const user = authenticatedUser(request)
  if (!user) {
    response.status(401).json({ message: 'Entre na sua conta para excluir um plano.' })
    return
  }
  const parsedContestId = identifierSchema.safeParse(request.params.contestId)
  if (!parsedContestId.success) {
    response.status(400).json({ message: 'Identificador de plano inválido.' })
    return
  }

  const database = readDatabase()
  const currentLibrary = database.studies[user.id]
  const existingPlan = currentLibrary?.plans.find(
    (state) => state.plan.contestId === parsedContestId.data,
  )
  if (!currentLibrary || !existingPlan) {
    response.status(404).json({ message: 'Plano não encontrado.' })
    return
  }

  const plans = currentLibrary.plans.filter(
    (state) => state.plan.contestId !== parsedContestId.data,
  )
  const updatedAt = new Date().toISOString()
  const nextLibrary: StudyLibraryRecord = {
    version: 1,
    activePlanId: currentLibrary.activePlanId === parsedContestId.data
      ? plans[0]?.plan.contestId ?? null
      : currentLibrary.activePlanId,
    plans,
    updatedAt,
  }
  if (plans.length) database.studies[user.id] = nextLibrary
  else delete database.studies[user.id]
  writeDatabase(database)
  response.json(nextLibrary)
})

if (servesStaticFiles) {
  app.use(express.static(join(rootDirectory, 'dist')))
  app.get('/{*splat}', (_request, response) =>
    response.sendFile(join(rootDirectory, 'dist', 'index.html')),
  )
}

startCatalogSynchronization()
startCatalogDiscovery()

app.listen(port, '127.0.0.1', () => {
  console.log(`GuiaConcursos API disponível em http://127.0.0.1:${port}`)
})
