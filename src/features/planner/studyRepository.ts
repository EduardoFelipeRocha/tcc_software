import type { PlanSubjectSummary, StoredStudyPlan, StudySession } from './types'
import { officialContests } from '../../data/official/contests'

export interface StudyState {
  plan: StoredStudyPlan
  completedSessionIds: string[]
  updatedAt: string
}

export interface StudyLibrary {
  version: 1
  activePlanId: string | null
  plans: StudyState[]
  updatedAt: string
}

const GUEST_KEY = 'guiaconcursos.guest-study.v2'
const MIGRATION_KEY = 'guiaconcursos.migration.rumo-v1'
const LEGACY_PLAN_KEY = 'rumo.study-plan.v1'
const LEGACY_COMPLETED_KEY = 'rumo.completed-sessions.v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function textValue(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function parseReferenceType(value: unknown): StoredStudyPlan['referenceType'] {
  if (value === 'current_notice' || value === 'previous_notice' || value === 'official_exam' || value === 'legacy_unverified') {
    return value
  }
  return 'legacy_unverified'
}

function parseWeightingBasis(value: unknown): StoredStudyPlan['weightingBasis'] {
  return value === 'official_distribution' ? 'official_distribution' : 'balanced_syllabus'
}

function parseSession(value: unknown, index: number): StudySession | null {
  if (!isRecord(value)) return null
  const subjectId = textValue(value.subjectId)
  const subjectName = textValue(value.subjectName)
  const weekday = textValue(value.weekday)
  if (!subjectId || !subjectName || !weekday) return null
  const kind = value.kind === 'Questões' || value.kind === 'Revisão ativa'
    ? value.kind
    : 'Teoria + resumo'
  return {
    id: textValue(value.id, `sessao-${index + 1}`),
    weekday,
    subjectId,
    subjectName,
    topic: textValue(value.topic, 'Revisão geral da disciplina'),
    minutes: Math.max(1, Math.round(numberValue(value.minutes, 50))),
    kind,
  }
}

function deriveSubjects(sessions: StudySession[]): PlanSubjectSummary[] {
  const summaries = new Map<string, PlanSubjectSummary>()
  sessions.forEach((session) => {
    const current = summaries.get(session.subjectId) ?? {
      id: session.subjectId,
      name: session.subjectName,
      topics: [],
      priority: 0,
      sessionCount: 0,
      totalMinutes: 0,
    }
    current.sessionCount += 1
    current.totalMinutes += session.minutes
    if (!current.topics.includes(session.topic)) current.topics.push(session.topic)
    summaries.set(session.subjectId, current)
  })
  const equalPriority = summaries.size ? Number((100 / summaries.size).toFixed(2)) : 0
  return [...summaries.values()].map((summary) => ({ ...summary, priority: equalPriority }))
}

function parseSubjects(value: unknown) {
  if (!Array.isArray(value)) return null
  const uniqueSubjects = new Map<string, PlanSubjectSummary>()
  value.forEach((subject) => {
    if (!isRecord(subject)) return []
    const id = textValue(subject.id)
    const name = textValue(subject.name)
    if (!id || !name) return []
    if (uniqueSubjects.has(id)) return []
    uniqueSubjects.set(id, {
      id,
      name,
      topics: Array.isArray(subject.topics)
        ? subject.topics.filter((topic): topic is string => typeof topic === 'string' && Boolean(topic.trim()))
        : [],
      priority: Math.max(0, numberValue(subject.priority)),
      sessionCount: Math.max(0, Math.round(numberValue(subject.sessionCount))),
      totalMinutes: Math.max(0, Math.round(numberValue(subject.totalMinutes))),
    })
    return []
  })
  const subjects = [...uniqueSubjects.values()]
  return subjects.length ? subjects : null
}

export function refreshVerifiedPlanTopics(
  contestId: string,
  referenceUrl: string,
  referenceYear: number | undefined,
  subjects: PlanSubjectSummary[],
) {
  const currentContest = officialContests.find((contest) => contest.id === contestId)
  const currentReference = currentContest?.studyReference
  if (!currentContest || !currentReference) return subjects

  const sameDocument = Boolean(referenceUrl) && currentReference.url === referenceUrl
  const sameEdition = Boolean(referenceYear) && currentReference.year === referenceYear
  if (!sameDocument && !sameEdition) return subjects

  const currentSubjects = new Map(currentContest.subjects.map((subject) => [subject.id, subject]))
  return subjects.map((subject) => {
    const currentSubject = currentSubjects.get(subject.id)
    return currentSubject?.topics.length
      ? { ...subject, name: currentSubject.name, topics: [...currentSubject.topics] }
      : subject
  })
}

function parsePlan(value: unknown): StoredStudyPlan | null {
  if (!isRecord(value) || !Array.isArray(value.sessions)) return null
  const sessions = value.sessions
    .map(parseSession)
    .filter((session): session is StudySession => Boolean(session))
  const contestId = textValue(value.contestId)
  const contestSlug = textValue(value.contestSlug)
  const contestTitle = textValue(value.contestTitle)
  if (!contestId || !contestSlug || !contestTitle || sessions.length === 0) return null
  const referenceLabel = textValue(value.referenceLabel, 'Referência registrada na versão anterior')
  const referenceUrl = textValue(value.referenceUrl)
  const referenceYear = numberValue(value.referenceYear) || undefined
  const storedSubjects = parseSubjects(value.subjects) ?? deriveSubjects(sessions)
  return {
    version: 1,
    algorithmVersion: '1.0.0',
    contestId,
    contestSlug,
    contestTitle,
    organization: textValue(value.organization, 'Concurso público'),
    referenceLabel,
    referenceType: parseReferenceType(value.referenceType),
    referenceUrl,
    referenceNote: textValue(
      value.referenceNote,
      'Plano migrado de uma versão anterior. Confira a página do concurso antes de continuar.',
    ),
    referenceYear,
    previousEditionLabel: textValue(value.previousEditionLabel) || undefined,
    previousEditionUrl: textValue(value.previousEditionUrl) || undefined,
    previousEditionYear: numberValue(value.previousEditionYear) || undefined,
    previousEditionNote: textValue(value.previousEditionNote) || undefined,
    weightingBasis: parseWeightingBasis(value.weightingBasis),
    generatedAt: textValue(value.generatedAt, new Date().toISOString()),
    hoursPerWeek: Math.max(1, numberValue(value.hoursPerWeek, 1)),
    weekdays: Array.isArray(value.weekdays)
      ? value.weekdays.filter((day): day is string => typeof day === 'string' && Boolean(day.trim()))
      : [...new Set(sessions.map((session) => session.weekday))],
    sessions,
    subjects: refreshVerifiedPlanTopics(contestId, referenceUrl, referenceYear, storedSubjects),
  }
}

function parseStudyState(value: unknown): StudyState | null {
  if (!isRecord(value)) return null
  const plan = parsePlan(value.plan)
  if (!plan) return null
  const validIds = new Set(plan.sessions.map((session) => session.id))
  const completedSessionIds = Array.isArray(value.completedSessionIds)
    ? [...new Set(value.completedSessionIds.filter(
      (id): id is string => typeof id === 'string' && validIds.has(id),
    ))]
    : []
  return {
    plan,
    completedSessionIds,
    updatedAt: textValue(value.updatedAt, new Date().toISOString()),
  }
}

function emptyLibrary(): StudyLibrary {
  return {
    version: 1,
    activePlanId: null,
    plans: [],
    updatedAt: new Date().toISOString(),
  }
}

function parseStudyLibrary(value: unknown): StudyLibrary | null {
  if (value === null) return emptyLibrary()
  if (!isRecord(value)) return null

  if (!Array.isArray(value.plans)) {
    const legacyState = parseStudyState(value)
    if (!legacyState) return null
    return {
      version: 1,
      activePlanId: legacyState.plan.contestId,
      plans: [legacyState],
      updatedAt: legacyState.updatedAt,
    }
  }

  const uniquePlans = new Map<string, StudyState>()
  value.plans.forEach((candidate) => {
    const state = parseStudyState(candidate)
    if (state) uniquePlans.set(state.plan.contestId, state)
  })
  const plans = [...uniquePlans.values()]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
  const requestedActiveId = textValue(value.activePlanId)
  const activePlanId = plans.some((state) => state.plan.contestId === requestedActiveId)
    ? requestedActiveId
    : plans[0]?.plan.contestId ?? null
  return {
    version: 1,
    activePlanId,
    plans,
    updatedAt: textValue(value.updatedAt, plans[0]?.updatedAt ?? new Date().toISOString()),
  }
}

function safeGuestState(): StudyState | null {
  try {
    const current = window.localStorage.getItem(GUEST_KEY)
    if (current) return parseStudyState(JSON.parse(current))
    if (window.localStorage.getItem(MIGRATION_KEY)) return null

    const legacyPlan = window.localStorage.getItem(LEGACY_PLAN_KEY)
    if (!legacyPlan) return null
    const legacyState = parseStudyState({
      plan: JSON.parse(legacyPlan),
      completedSessionIds: JSON.parse(window.localStorage.getItem(LEGACY_COMPLETED_KEY) ?? '[]'),
      updatedAt: new Date().toISOString(),
    })
    if (!legacyState) return null

    window.localStorage.setItem(GUEST_KEY, JSON.stringify(legacyState))
    const confirmed = parseStudyState(JSON.parse(window.localStorage.getItem(GUEST_KEY) ?? 'null'))
    if (!confirmed) return null
    window.localStorage.setItem(MIGRATION_KEY, new Date().toISOString())
    return confirmed
  } catch {
    return null
  }
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const { headers, ...requestOptions } = options ?? {}
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...requestOptions,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(error?.message ?? 'Não foi possível salvar seu progresso.')
  }
  return response.json() as Promise<T>
}

export function findStudyState(library: StudyLibrary, requestedPlanId?: string | null) {
  if (requestedPlanId) {
    return library.plans.find((state) => state.plan.contestId === requestedPlanId) ?? null
  }
  return library.plans.find((state) => state.plan.contestId === library.activePlanId)
    ?? library.plans[0]
    ?? null
}

export function compatibleCompletedSessionIds(
  previousPlan: StoredStudyPlan,
  nextPlan: StoredStudyPlan,
  completedSessionIds: string[],
) {
  const previousSessions = new Map(previousPlan.sessions.map((session) => [session.id, session]))
  const nextSessions = new Map(nextPlan.sessions.map((session) => [session.id, session]))
  return completedSessionIds.filter((id) => {
    const previous = previousSessions.get(id)
    const next = nextSessions.get(id)
    return Boolean(
      previous && next &&
      previous.subjectId === next.subjectId &&
      previous.topic === next.topic &&
      previous.kind === next.kind,
    )
  })
}

export const studyRepository = {
  loadGuest: safeGuestState,
  saveGuest(plan: StoredStudyPlan, completedSessionIds: string[] = []) {
    const state = parseStudyState({ plan, completedSessionIds, updatedAt: new Date().toISOString() })
    if (!state) throw new Error('O plano gerado é inválido.')
    window.localStorage.setItem(GUEST_KEY, JSON.stringify(state))
    return state
  },
  clearGuest() {
    window.localStorage.removeItem(GUEST_KEY)
  },
  async loadAccount() {
    const raw = await apiRequest<unknown>('/api/study')
    const library = parseStudyLibrary(raw)
    if (!library) throw new Error('Seus planos salvos estão em um formato inválido.')
    return library
  },
  async saveAccount(
    plan: StoredStudyPlan,
    completedSessionIds: string[] = [],
    signal?: AbortSignal,
  ) {
    const raw = await apiRequest<unknown>('/api/study', {
      method: 'PUT',
      body: JSON.stringify({ plan, completedSessionIds }),
      signal,
    })
    const library = parseStudyLibrary(raw)
    if (!library) throw new Error('O servidor não confirmou o plano salvo.')
    return library
  },
  async saveAccountPreservingProgress(plan: StoredStudyPlan) {
    const library = await this.loadAccount()
    const existing = library.plans.find((state) => state.plan.contestId === plan.contestId)
    const completedSessionIds = existing
      ? compatibleCompletedSessionIds(existing.plan, plan, existing.completedSessionIds)
      : []
    return this.saveAccount(plan, completedSessionIds)
  },
  async deleteAccountPlan(contestId: string) {
    const raw = await apiRequest<unknown>(`/api/study/${encodeURIComponent(contestId)}`, {
      method: 'DELETE',
    })
    const library = parseStudyLibrary(raw)
    if (!library) throw new Error('O servidor não confirmou a exclusão do plano.')
    return library
  },
  async importGuestToAccount() {
    const guest = safeGuestState()
    if (!guest) return null
    const saved = await this.saveAccount(guest.plan, guest.completedSessionIds)
    this.clearGuest()
    return saved
  },
}
