import { describe, expect, it } from 'vitest'
import { contestRepository } from './contestRepository'

describe('contestRepository', () => {
  it('combina termos de busca mesmo quando aparecem separados nos dados', async () => {
    const results = await contestRepository.list({ query: 'Bombeiros RJ' })

    expect(results.map((contest) => contest.id)).toContain('cbmerj-soldado')
  })

  it('normaliza acentos e caixa na busca', async () => {
    const results = await contestRepository.list({ query: 'tecnico judiciaria' })

    expect(results.map((contest) => contest.id)).toContain('tjrj-tecnico')
  })
})
