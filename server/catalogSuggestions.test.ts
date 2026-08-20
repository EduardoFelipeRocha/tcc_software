import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CatalogSuggestionStore } from './catalogSuggestions'

const temporaryDirectories: string[] = []

function createStore() {
  const directory = mkdtempSync(join(tmpdir(), 'guiaconcursos-suggestion-'))
  temporaryDirectories.push(directory)
  const file = join(directory, 'suggestions.json')
  return { file, store: new CatalogSuggestionStore(file) }
}

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    rmSync(directory, { recursive: true, force: true })
  })
})

describe('indicações de concursos ausentes', () => {
  it('persiste a indicação como pendente sem acessar o link informado', () => {
    const { file, store } = createStore()
    const result = store.submit({
      contestName: 'Guarda Municipal',
      organization: 'Prefeitura de Maricá',
      municipality: 'Maricá',
      uf: 'RJ',
      officialUrl: 'https://www.marica.rj.gov.br/concursos/',
      details: 'Anúncio da prefeitura.',
      website: '',
    }, new Date('2026-08-14T15:00:00.000Z'))

    expect(result.stored).toBe(true)
    expect(result.protocol).toMatch(/^GC-20260814-/)
    expect(store.metrics()).toMatchObject({ total: 1, pending: 1, storageHealthy: true })
    expect(readFileSync(file, 'utf8')).toContain('"status":"pending"')
  })

  it('deduplica a mesma indicação normalizando caixa e acentos', () => {
    const { store } = createStore()
    const first = store.submit({
      contestName: 'Guarda Municipal',
      organization: 'Prefeitura de Maricá',
      municipality: 'Maricá',
      uf: 'RJ',
    })
    const duplicate = store.submit({
      contestName: 'guarda municipal',
      organization: 'PREFEITURA DE MARICA',
      municipality: 'marica',
      uf: 'RJ',
    })

    expect(duplicate).toMatchObject({ duplicate: true, protocol: first.protocol })
    expect(store.metrics().total).toBe(1)
  })

  it('ignora silenciosamente o honeypot e rejeita URL sem HTTPS', () => {
    const { store } = createStore()
    expect(store.submit({
      contestName: 'Concurso teste',
      organization: 'Órgão teste',
      uf: 'SP',
      website: 'spam.example',
    }).stored).toBe(false)
    expect(store.metrics().total).toBe(0)

    expect(() => store.submit({
      contestName: 'Concurso teste',
      organization: 'Órgão teste',
      uf: 'SP',
      officialUrl: 'http://example.com/edital',
    })).toThrow(/HTTPS/i)

    expect(() => store.submit({
      contestName: 'Concurso teste',
      organization: 'Órgão teste',
      uf: 'SP',
      officialUrl: 'não é uma URL',
    })).toThrow(/link HTTPS válido/i)
  })

  it('falha fechado e não sobrescreve um log corrompido', () => {
    const directory = mkdtempSync(join(tmpdir(), 'guiaconcursos-suggestion-'))
    temporaryDirectories.push(directory)
    const file = join(directory, 'suggestions.ndjson')
    writeFileSync(file, '{registro-corrompido}\n', 'utf8')
    const store = new CatalogSuggestionStore(file)

    expect(store.metrics()).toMatchObject({ storageHealthy: false, total: 0 })
    expect(() => store.submit({
      contestName: 'Concurso teste',
      organization: 'Órgão teste',
      uf: 'SP',
    })).toThrow(/armazenamento de indicações indisponível/i)
    expect(readFileSync(file, 'utf8')).toBe('{registro-corrompido}\n')
  })

  it('preserva uma nova evidência textual em vez de descartá-la como duplicada', () => {
    const { store } = createStore()
    store.submit({
      contestName: 'Guarda Municipal',
      organization: 'Prefeitura de Maricá',
      municipality: 'Maricá',
      uf: 'RJ',
      details: 'Anúncio inicial.',
    })
    const enriched = store.submit({
      contestName: 'Guarda Municipal',
      organization: 'Prefeitura de Maricá',
      municipality: 'Maricá',
      uf: 'RJ',
      details: 'Portaria formal localizada depois.',
    })

    expect(enriched.duplicate).toBe(false)
    expect(store.metrics().total).toBe(2)
  })
})
