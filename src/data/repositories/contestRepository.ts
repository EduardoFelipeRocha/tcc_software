import type { CatalogSnapshot, Contest, ContestFilters } from '../../entities/contest/types'
import {
  buildBundledCatalogSnapshot,
  filterAndSortContests,
} from '../catalog/catalogRules'
import { officialContests } from '../official/contests'

export interface ContestRepository {
  getCatalog(): Promise<CatalogSnapshot>
  list(filters?: ContestFilters): Promise<Contest[]>
  getBySlug(slug: string): Promise<Contest | undefined>
  getFeatured(): Promise<Contest[]>
}

const CACHE_TTL_MS = 60 * 1_000
let cachedCatalog: { snapshot: CatalogSnapshot; expiresAt: number } | null = null
let catalogRequest: Promise<CatalogSnapshot> | null = null

function fallbackCatalog() {
  return buildBundledCatalogSnapshot(officialContests, 'fallback')
}

function isCatalogSnapshot(value: unknown): value is CatalogSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<CatalogSnapshot>
  return Array.isArray(candidate.contests) &&
    typeof candidate.meta === 'object' &&
    candidate.meta !== null &&
    typeof candidate.meta.total === 'number' &&
    typeof candidate.meta.generatedAt === 'string'
}

async function requestCatalog() {
  if (typeof window === 'undefined') return fallbackCatalog()
  if (cachedCatalog && cachedCatalog.expiresAt > Date.now()) return cachedCatalog.snapshot
  if (catalogRequest) return catalogRequest

  catalogRequest = fetch('/api/catalog', {
    headers: { Accept: 'application/json' },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('O catálogo não pôde ser carregado.')
      const payload = await response.json() as unknown
      if (!isCatalogSnapshot(payload)) throw new Error('A API retornou um catálogo inválido.')
      return payload
    })
    .catch(() => fallbackCatalog())
    .then((snapshot) => {
      cachedCatalog = { snapshot, expiresAt: Date.now() + CACHE_TTL_MS }
      return snapshot
    })
    .finally(() => {
      catalogRequest = null
    })

  return catalogRequest
}

export const contestRepository: ContestRepository = {
  getCatalog: requestCatalog,

  async list(filters = {}) {
    const snapshot = await requestCatalog()
    return filterAndSortContests([...snapshot.contests], filters)
  },

  async getBySlug(slug) {
    const snapshot = await requestCatalog()
    return snapshot.contests.find((contest) => contest.slug === slug)
  },

  async getFeatured() {
    const snapshot = await requestCatalog()
    const active = filterAndSortContests(
      snapshot.contests.filter((contest) => contest.phase !== 'closed'),
      { sort: 'recent' },
    )
    const explicitlyFeatured = active.filter((contest) => contest.featured)
    const remaining = active.filter((contest) => !contest.featured)
    return [...explicitlyFeatured, ...remaining].slice(0, 6)
  },
}
