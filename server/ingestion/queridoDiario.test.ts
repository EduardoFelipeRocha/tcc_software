import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  QueridoDiarioConnector,
  QUERIDO_DIARIO_SOURCE_ID,
} from './queridoDiario.ts'
import { detectHighSignalTerms, queridoDiarioHighSignalQuery } from './signals.ts'

const fixedNow = new Date('2026-08-14T15:00:00.000Z')

function jsonResponse(value: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(value), {
    status: 200,
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init.headers,
    },
  })
}

function maricaItem(overrides: Record<string, unknown> = {}) {
  return {
    territory_id: '3302700',
    territory_name: 'Maricá',
    state_code: 'RJ',
    date: '2026-08-14',
    edition: '1520',
    is_extra_edition: false,
    url: 'https://diario.marica.rj.gov.br/edicao/1520.pdf',
    excerpts: [
      'DECRETO: fica autorizada a realização de concurso público para a Guarda Municipal.',
    ],
    scraped_at: '2026-08-14T14:55:00.009077',
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('conector do Querido Diário', () => {
  it('não acessa a rede ao ser construído e usa somente busca de alto sinal', () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    const connector = new QueridoDiarioConnector({ fetchImplementation })

    expect(fetchImplementation).not.toHaveBeenCalled()
    const url = connector.buildRequestUrl({ territoryIds: ['3302700'] })
    expect(url.hostname).toBe('api.queridodiario.ok.org.br')
    expect(url.searchParams.get('territory_ids')).toBe('3302700')
    expect(url.searchParams.get('querystring')).toBe(queridoDiarioHighSignalQuery)
    expect(url.searchParams.get('querystring')).toContain('concurso público')
  })

  it('gera eventos pendentes, ignora ruído e coloca item inválido em quarentena', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      total_gazettes: 3,
      gazettes: [
        maricaItem(),
        maricaItem({ territory_id: 'invalido' }),
        maricaItem({
          edition: '1521',
          url: 'https://diario.marica.rj.gov.br/edicao/1521.pdf',
          excerpts: ['Aviso sobre manutenção de equipamentos da prefeitura.'],
        }),
      ],
    }))
    const connector = new QueridoDiarioConnector({
      fetchImplementation,
      clock: () => fixedNow,
    })

    const page = await connector.fetchPage({ territoryIds: ['3302700'] })

    expect(page.events).toHaveLength(1)
    expect(page.events[0]).toMatchObject({
      status: 'pending',
      requiresOfficialVerification: true,
      sourceId: QUERIDO_DIARIO_SOURCE_ID,
      sourceTrust: 'secondary',
      eventKind: 'authorization',
      municipality: { ibgeCode: '3302700', name: 'Maricá', uf: 'RJ' },
      evidenceUrl: 'https://diario.marica.rj.gov.br/edicao/1520.pdf',
      publishedOn: '2026-08-14',
      sourceScrapedAt: '2026-08-14T14:55:00.009Z',
      discoveredAt: fixedNow.toISOString(),
    })
    expect(page.events[0]?.contentHash).toMatch(/^[a-f\d]{64}$/)
    expect(page.events[0]?.id).toMatch(/^[a-f\d]{64}$/)
    expect(page.quarantined).toHaveLength(1)
    expect(page.quarantined[0]?.externalIdHint).toContain('invalido')
    expect(page.ignoredWithoutSignal).toBe(1)
    expect(page.nextOffset).toBeNull()
    expect(fetchImplementation).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: 'api.queridodiario.ok.org.br' }),
      expect.objectContaining({ method: 'GET', redirect: 'manual' }),
    )
  })

  it('deduplica o mesmo item dentro da página', async () => {
    const item = maricaItem()
    const connector = new QueridoDiarioConnector({
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
        total_gazettes: 2,
        gazettes: [item, item],
      })),
      clock: () => fixedNow,
    })

    const page = await connector.fetchPage()
    expect(page.events).toHaveLength(1)
    expect(page.duplicatesInPage).toBe(1)
  })

  it('recusa origem fora da allowlist, redirect e corpo maior que o limite', async () => {
    expect(() => new QueridoDiarioConnector({
      baseUrl: 'https://example.com/',
    })).toThrow(/allowlist/i)

    const redirectConnector = new QueridoDiarioConnector({
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(new Response('', {
        status: 302,
        headers: { location: 'https://example.com/' },
      })),
    })
    await expect(redirectConnector.fetchPage()).rejects.toThrow(/redirecionamento/i)

    const oversizedConnector = new QueridoDiarioConnector({
      maximumBodyBytes: 1_024,
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(
        { total_gazettes: 0, gazettes: [], padding: 'x'.repeat(2_000) },
      )),
    })
    await expect(oversizedConnector.fetchPage()).rejects.toThrow(/limite/i)
  })

  it('aborta uma requisição que ultrapassa o timeout', async () => {
    vi.useFakeTimers()
    const fetchImplementation = vi.fn<typeof fetch>((_input, init) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'))
      })
    }))
    const connector = new QueridoDiarioConnector({
      fetchImplementation,
      timeoutMs: 500,
    })

    const request = expect(connector.fetchPage()).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(500)
    await request
  })
})

describe('detecção de sinais', () => {
  it('prioriza eventos críticos e não aceita a palavra concurso isolada', () => {
    expect(detectHighSignalTerms(
      'Fica suspenso o concurso público da Guarda Municipal.',
    )?.kind).toBe('suspension')
    expect(detectHighSignalTerms('Resultado do concurso cultural de fotografia.')).toBeNull()
  })
})
