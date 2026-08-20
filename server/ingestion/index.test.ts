import { describe, expect, it, vi } from 'vitest'
import {
  getDiscoveryHealth,
  listDiscoveryEvents,
  startDiscoverySynchronization,
  submitManualDiscoverySuggestion,
} from './index.ts'
import type { DiscoveryPage } from './schemas.ts'

describe('API estável do radar', () => {
  it('insere sugestão manual sem buscar a URL e sempre a mantém pendente', () => {
    const network = vi.spyOn(globalThis, 'fetch')
    const input = {
      municipalityIbgeCode: '3302700',
      municipalityName: 'Maricá',
      uf: 'RJ' as const,
      evidenceUrl: 'https://www.marica.rj.gov.br/noticia/guarda-municipal/#detalhes',
      title: 'Concurso da Guarda Municipal de Maricá',
      note: 'A prefeitura informou que o novo concurso público foi autorizado.',
      publishedOn: '2026-08-14',
    }

    const first = submitManualDiscoverySuggestion(input, {
      clock: () => new Date('2026-08-14T16:00:00.000Z'),
    })
    const duplicate = submitManualDiscoverySuggestion({
      ...input,
      note: 'Outra descrição para a mesma URL oficial do concurso.',
    }, {
      clock: () => new Date('2026-08-14T16:01:00.000Z'),
    })

    expect(network).not.toHaveBeenCalled()
    network.mockRestore()
    expect(first.inserted).toBe(true)
    expect(first.event).toMatchObject({
      status: 'pending',
      sourceTrust: 'community',
      requiresOfficialVerification: true,
    })
    expect(first.event.evidenceUrl).not.toContain('#')
    expect(duplicate.deduplicated).toBe(true)
    expect(listDiscoveryEvents({ municipalityIbgeCode: '3302700' }))
      .toContainEqual(first.event)
  })

  it('sincroniza por um runner opt-in e expõe health/metrics sem autopublicar', async () => {
    const page: DiscoveryPage = {
      sourceId: 'querido-diario',
      requestUrl: 'https://api.queridodiario.ok.org.br/gazettes',
      requestedAt: '2026-08-14T17:00:00.000Z',
      totalAvailable: 0,
      offset: 0,
      receivedItems: 0,
      ignoredWithoutSignal: 0,
      duplicatesInPage: 0,
      nextOffset: null,
      events: [],
      quarantined: [],
    }
    const connector = {
      fetchPage: vi.fn().mockResolvedValue(page),
    }
    const timestamps = [
      new Date('2026-08-14T17:00:00.000Z'),
      new Date('2026-08-14T17:00:01.000Z'),
      new Date('2026-08-14T17:00:02.000Z'),
      new Date('2026-08-14T17:00:03.000Z'),
    ]
    const clock = () => timestamps.shift() ?? new Date('2026-08-14T17:00:04.000Z')
    const handle = startDiscoverySynchronization({
      enabled: true,
      runImmediately: false,
      connector,
      clock,
    })

    const summary = await handle.runNow()
    expect(summary.pagesFetched).toBe(1)
    expect(connector.fetchPage).toHaveBeenCalledOnce()
    expect(getDiscoveryHealth()).toMatchObject({
      status: 'healthy',
      enabled: true,
      running: false,
      runsSucceeded: 1,
      lastError: null,
    })
    handle.stop()
    expect(getDiscoveryHealth().enabled).toBe(false)

    const failedHandle = startDiscoverySynchronization({
      enabled: true,
      runImmediately: false,
      connector: {
        fetchPage: vi.fn().mockRejectedValue(new Error(
          'Falha em https://api.queridodiario.ok.org.br/?token=segredo',
        )),
      },
      clock: () => new Date('2026-08-14T18:00:00.000Z'),
    })
    await expect(failedHandle.runNow()).rejects.toThrow(/Falha/)
    expect(getDiscoveryHealth()).toMatchObject({
      status: 'degraded',
      runsFailed: 1,
      lastError: 'Falha em [URL removida]',
    })
    expect(getDiscoveryHealth().lastError).not.toContain('segredo')
    failedHandle.stop()
  })
})
