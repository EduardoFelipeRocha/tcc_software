import type { Contest, ContestFilters } from '../../entities/contest/types'
import { mockContests } from '../mocks/contests'

export interface ContestRepository {
  list(filters?: ContestFilters): Promise<Contest[]>
  getBySlug(slug: string): Promise<Contest | undefined>
  getFeatured(): Promise<Contest[]>
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')

export const contestRepository: ContestRepository = {
  async list(filters = {}) {
    const query = normalize(filters.query?.trim() ?? '')
    const queryTerms = query.split(/\s+/).filter(Boolean)

    return mockContests.filter((contest) => {
      const haystack = normalize(
        [
          contest.title,
          contest.organization,
          contest.acronym,
          contest.area,
          contest.uf,
          contest.scopeLabel,
        ].join(' '),
      )

      return (
        (queryTerms.length === 0 || queryTerms.every((term) => haystack.includes(term))) &&
        (!filters.uf || filters.uf === 'all' || contest.uf === filters.uf || contest.uf === 'BR') &&
        (!filters.phase || filters.phase === 'all' || contest.phase === filters.phase) &&
        (!filters.education ||
          filters.education === 'all' ||
          contest.education.includes(filters.education))
      )
    })
  },

  async getBySlug(slug) {
    return mockContests.find((contest) => contest.slug === slug)
  },

  async getFeatured() {
    return mockContests.filter((contest) => contest.featured)
  },
}
