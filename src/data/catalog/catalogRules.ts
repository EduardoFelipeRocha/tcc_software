import type {
  CatalogMeta,
  CatalogMode,
  CatalogSnapshot,
  Contest,
  ContestFilters,
  ContestPhase,
} from '../../entities/contest/types'

const DAY_IN_MS = 24 * 60 * 60 * 1000

const preparationPhases = new Set<ContestPhase>([
  'organizer_selected',
  'committee_formed',
  'authorized',
  'expected',
])

const queryStopWords = new Set([
  'a',
  'as',
  'com',
  'concurso',
  'concursos',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'em',
  'na',
  'nas',
  'no',
  'nos',
  'o',
  'os',
  'para',
  'por',
])

const queryAliases: Record<string, string> = {
  estaduais: 'estadual',
  federais: 'federal',
  municipais: 'municipal',
}

export const normalizeCatalogText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')

const normalizedQueryTerms = (query: string) =>
  normalizeCatalogText(query)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((term) => !queryStopWords.has(term))
    .map((term) => queryAliases[term] ?? term)

function dateInSaoPaulo(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function phaseForDate(contest: Contest, now: Date): ContestPhase {
  const today = dateInSaoPaulo(now)

  if (
    contest.registrationStartsAt &&
    contest.registrationEndsAt &&
    contest.registrationStartsAt <= today &&
    contest.registrationEndsAt >= today &&
    (contest.phase === 'notice_published' || contest.phase === 'registration_open')
  ) {
    return 'registration_open'
  }

  if (
    contest.registrationEndsAt &&
    contest.registrationEndsAt < today &&
    (contest.phase === 'notice_published' || contest.phase === 'registration_open')
  ) {
    return 'in_progress'
  }

  return contest.phase
}

export function applyCatalogLifecycle(contest: Contest, now = new Date()): Contest {
  const phase = phaseForDate(contest, now)
  if (phase === contest.phase) return contest

  const registrationEnded = contest.registrationEndsAt &&
    contest.registrationEndsAt < dateInSaoPaulo(now) &&
    (contest.phase === 'notice_published' || contest.phase === 'registration_open')

  return {
    ...contest,
    phase,
    deadlineLabel: registrationEnded
      ? `Inscrições encerradas em ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${contest.registrationEndsAt}T12:00:00Z`))}`
      : contest.deadlineLabel,
  }
}

function queryMatches(contest: Contest, query: string) {
  const terms = normalizedQueryTerms(query)
  if (!terms.length) return true

  const haystack = normalizeCatalogText([
    'concurso concursos área nivel nível',
    contest.title,
    contest.organization,
    contest.acronym,
    contest.area,
    contest.uf,
    contest.municipalityName ?? '',
    contest.municipalityIbgeCode ?? '',
    contest.region,
    contest.scopeLabel,
    contest.governmentLevel,
    contest.organizer,
    contest.openingsLabel,
    contest.shortDescription,
    contest.deadlineLabel,
    contest.education.join(' '),
    contest.subjects.map((subject) => subject.name).join(' '),
  ].join(' '))

  return terms.every((term) => haystack.includes(term))
}

function deadlineTimestamp(contest: Contest) {
  if (!contest.registrationEndsAt) return Number.POSITIVE_INFINITY
  const parsed = Date.parse(`${contest.registrationEndsAt}T23:59:59Z`)
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

export function filterAndSortContests(contests: Contest[], filters: ContestFilters = {}) {
  const filtered = contests.filter((contest) => (
    queryMatches(contest, filters.query?.trim() ?? '') &&
    (!filters.uf || filters.uf === 'all' || contest.uf === filters.uf) &&
    (!filters.municipality ||
      filters.municipality === 'all' ||
      contest.municipalityIbgeCode === filters.municipality) &&
    (!filters.phase ||
      filters.phase === 'all' ||
      contest.phase === filters.phase ||
      (filters.phase === 'preparation' && preparationPhases.has(contest.phase))) &&
    (!filters.education ||
      filters.education === 'all' ||
      contest.education.includes(filters.education)) &&
    (!filters.governmentLevel ||
      filters.governmentLevel === 'all' ||
      contest.governmentLevel === filters.governmentLevel) &&
    (!filters.area || filters.area === 'all' || contest.area === filters.area)
  ))

  return filtered.sort((left, right) => {
    switch (filters.sort) {
      case 'title':
        return `${left.acronym} ${left.title}`.localeCompare(
          `${right.acronym} ${right.title}`,
          'pt-BR',
        )
      case 'deadline':
        return deadlineTimestamp(left) - deadlineTimestamp(right) ||
          right.lastVerified.localeCompare(left.lastVerified)
      case 'recent':
        return right.lastVerified.localeCompare(left.lastVerified) ||
          `${left.acronym} ${left.title}`.localeCompare(`${right.acronym} ${right.title}`, 'pt-BR')
      default:
        return Number(left.phase === 'closed') - Number(right.phase === 'closed') ||
          Number(right.featured) - Number(left.featured) ||
          right.lastVerified.localeCompare(left.lastVerified) ||
          deadlineTimestamp(left) - deadlineTimestamp(right)
    }
  })
}

export function isContestVerificationStale(contest: Contest, now = new Date()) {
  const checkedAt = Date.parse(`${contest.lastVerified}T23:59:59Z`)
  if (Number.isNaN(checkedAt)) return true

  const ageInDays = (now.getTime() - checkedAt) / DAY_IN_MS
  const maximumAge = contest.phase === 'registration_open'
    ? 3
    : contest.phase === 'notice_published' || contest.phase === 'in_progress'
      ? 7
      : contest.phase === 'closed'
        ? 365
        : 14

  return ageInDays > maximumAge
}

interface CatalogMetaOptions {
  mode: CatalogMode
  automaticUpdates?: boolean
  configuredFeeds?: number
  healthyFeeds?: number
  failedFeeds?: number
  lastSuccessfulSync?: string | null
  nextScheduledSync?: string | null
  now?: Date
}

export function buildCatalogMeta(
  contests: Contest[],
  options: CatalogMetaOptions,
): CatalogMeta {
  const now = options.now ?? new Date()
  const verificationDates = contests
    .map((contest) => contest.lastVerified)
    .filter(Boolean)
    .sort()

  return {
    generatedAt: now.toISOString(),
    lastSuccessfulSync: options.lastSuccessfulSync ?? null,
    nextScheduledSync: options.nextScheduledSync ?? null,
    newestVerification: verificationDates.at(-1) ?? null,
    oldestVerification: verificationDates[0] ?? null,
    automaticUpdates: options.automaticUpdates ?? false,
    configuredFeeds: options.configuredFeeds ?? 0,
    healthyFeeds: options.healthyFeeds ?? 0,
    failedFeeds: options.failedFeeds ?? 0,
    total: contests.length,
    active: contests.filter((contest) => contest.phase !== 'closed').length,
    stale: contests.filter((contest) => isContestVerificationStale(contest, now)).length,
    regionalUnitsCovered: new Set(
      contests.filter((contest) => contest.uf !== 'BR').map((contest) => contest.uf),
    ).size,
    municipalitiesWithPublishedRecords: new Set(
      contests
        .map((contest) => contest.municipalityIbgeCode)
        .filter((code): code is string => Boolean(code)),
    ).size,
    mode: options.mode,
  }
}

export function buildBundledCatalogSnapshot(
  contests: Contest[],
  mode: CatalogMode = 'bundled',
  now = new Date(),
): CatalogSnapshot {
  const lifecycleContests = contests.map((contest) => applyCatalogLifecycle(contest, now))
  return {
    contests: lifecycleContests,
    meta: buildCatalogMeta(lifecycleContests, { mode, now }),
  }
}
