import {
  Activity,
  AlertTriangle,
  Filter,
  Map as MapIcon,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { filterAndSortContests } from '../data/catalog/catalogRules'
import { contestRepository } from '../data/repositories/contestRepository'
import { phaseLabels } from '../entities/contest/labels'
import { CatalogSuggestion } from '../features/catalog/CatalogSuggestion'
import type {
  CatalogSnapshot,
  ContestFilters,
  ContestPhaseFilter,
  ContestSort,
  GovernmentLevel,
} from '../entities/contest/types'
import { ContestCard } from '../shared/ui/ContestCard'

const phases: ContestPhaseFilter[] = [
  'all',
  'registration_open',
  'notice_published',
  'in_progress',
  'preparation',
  'organizer_selected',
  'committee_formed',
  'authorized',
  'expected',
  'closed',
]

const phaseOptions = new Set<string>(phases)
const governmentLevels: Array<GovernmentLevel | 'all'> = [
  'all',
  'Federal',
  'Estadual',
  'Municipal',
]
const governmentLevelOptions = new Set<string>(governmentLevels)
const sorts: ContestSort[] = ['relevance', 'recent', 'deadline', 'title']
const sortOptions = new Set<string>(sorts)
const pageSize = 24

interface CatalogRadarHealth {
  status: 'idle' | 'running' | 'healthy' | 'degraded'
  enabled: boolean
  lastSuccessfulRunAt: string | null
  coverageStatement: string
  store: {
    pendingEvents: number
    municipalitiesWithSignals: number
    ufsWithSignals: number
  }
}

const locationNames: Record<string, string> = {
  BR: 'Abrangência nacional',
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
}

function formatDate(value: string | null) {
  if (!value) return 'ainda não executada'
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value.slice(0, 10)}T12:00:00`))
}

function SearchForm({
  initialQuery,
  onSearch,
}: {
  initialQuery: string
  onSearch: (query: string) => void
}) {
  const [queryInput, setQueryInput] = useState(initialQuery)

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    onSearch(queryInput.trim())
  }

  const clearSearch = () => {
    setQueryInput('')
    onSearch('')
  }

  return (
    <form className="catalog-search" role="search" onSubmit={submitSearch}>
      <Search size={20} aria-hidden="true" />
      <label className="sr-only" htmlFor="catalog-query">Buscar concursos</label>
      <input
        id="catalog-query"
        value={queryInput}
        onChange={(event) => setQueryInput(event.target.value)}
        placeholder="Cargo, órgão, área, banca ou estado"
      />
      {queryInput && (
        <button className="clear-search" type="button" aria-label="Limpar busca" onClick={clearSearch}>
          <X size={17} />
        </button>
      )}
      <button className="button button-primary" type="submit">Buscar</button>
    </form>
  )
}

export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(null)
  const [radarHealth, setRadarHealth] = useState<CatalogRadarHealth | null>(null)

  const allContests = catalog?.contests ?? []
  const municipalityOptions = useMemo(() => [...new Map(
    allContests
      .filter((contest) => contest.municipalityIbgeCode && contest.municipalityName)
      .map((contest) => [contest.municipalityIbgeCode!, {
        code: contest.municipalityIbgeCode!,
        name: contest.municipalityName!,
        uf: contest.uf,
      }]),
  ).values()].sort((left, right) => (
    left.name.localeCompare(right.name, 'pt-BR') || left.uf.localeCompare(right.uf)
  )), [allContests])
  const educationOptions = useMemo(() => [...new Set(
    allContests.flatMap((contest) => contest.education),
  )].sort((left, right) => left.localeCompare(right, 'pt-BR')), [allContests])
  const areaOptions = useMemo(() => [...new Set(
    allContests.map((contest) => contest.area),
  )].sort((left, right) => left.localeCompare(right, 'pt-BR')), [allContests])

  const query = searchParams.get('q') ?? ''
  const requestedUf = searchParams.get('uf') ?? 'all'
  const uf = requestedUf === 'all' || requestedUf in locationNames ? requestedUf : 'all'
  const requestedMunicipality = searchParams.get('municipio') ?? 'all'
  const municipality = requestedMunicipality === 'all' || municipalityOptions.some(
    (option) => option.code === requestedMunicipality,
  ) ? requestedMunicipality : 'all'
  const phaseParam = searchParams.get('status') ?? 'all'
  const phase = (phaseOptions.has(phaseParam) ? phaseParam : 'all') as ContestPhaseFilter
  const requestedEducation = searchParams.get('escolaridade') ?? 'all'
  const education = requestedEducation === 'all' || educationOptions.includes(requestedEducation)
    ? requestedEducation
    : 'all'
  const governmentLevelParam = searchParams.get('esfera') ?? 'all'
  const governmentLevel = (
    governmentLevelOptions.has(governmentLevelParam) ? governmentLevelParam : 'all'
  ) as GovernmentLevel | 'all'
  const requestedArea = searchParams.get('area') ?? 'all'
  const area = requestedArea === 'all' || areaOptions.includes(requestedArea)
    ? requestedArea
    : 'all'
  const sortParam = searchParams.get('ordem') ?? 'relevance'
  const sort = (sortOptions.has(sortParam) ? sortParam : 'relevance') as ContestSort
  const requestedPage = Number(searchParams.get('pagina') ?? 1)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    void contestRepository.getCatalog().then((snapshot) => {
      if (active) setCatalog(snapshot)
    })
    void fetch('/api/catalog/radar/health', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok && response.status !== 206) return null
      return response.json() as Promise<CatalogRadarHealth>
    }).then((health) => {
      if (active && health) setRadarHealth(health)
    }).catch(() => undefined)
    return () => {
      active = false
      controller.abort()
    }
  }, [])

  const serializedSearchParams = searchParams.toString()

  useEffect(() => {
    if (!catalog) return

    const next = new URLSearchParams(serializedSearchParams)
    const invalidKeys = [
      requestedUf !== uf ? 'uf' : null,
      requestedMunicipality !== municipality ? 'municipio' : null,
      phaseParam !== phase ? 'status' : null,
      requestedEducation !== education ? 'escolaridade' : null,
      governmentLevelParam !== governmentLevel ? 'esfera' : null,
      requestedArea !== area ? 'area' : null,
      sortParam !== sort ? 'ordem' : null,
    ].filter((key): key is string => Boolean(key))

    if (!invalidKeys.length) return
    invalidKeys.forEach((key) => next.delete(key))
    setSearchParams(next, { replace: true })
  }, [
    area,
    catalog,
    education,
    governmentLevel,
    governmentLevelParam,
    phase,
    phaseParam,
    municipality,
    requestedMunicipality,
    requestedArea,
    requestedEducation,
    requestedUf,
    serializedSearchParams,
    setSearchParams,
    sort,
    sortParam,
    uf,
  ])

  const contests = useMemo(() => filterAndSortContests([...allContests], {
    query,
    uf,
    municipality,
    phase,
    education,
    governmentLevel,
    area,
    sort,
  }), [allContests, area, education, governmentLevel, municipality, phase, query, sort, uf])

  const activeFilterCount = [
    query,
    uf !== 'all',
    municipality !== 'all',
    phase !== 'all',
    education !== 'all',
    governmentLevel !== 'all',
    area !== 'all',
  ].filter(Boolean).length

  const facetCount = (overrides: Partial<ContestFilters>) =>
    filterAndSortContests([...allContests], {
      query,
      uf,
      municipality,
      phase,
      education,
      governmentLevel,
      area,
      ...overrides,
    }).length

  const phaseCount = (requestedPhase: ContestPhaseFilter) =>
    facetCount({ phase: requestedPhase })

  const totalPages = Math.max(1, Math.ceil(contests.length / pageSize))
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, totalPages)
    : 1
  const visibleContests = contests.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (!value || value === 'all' || (key === 'ordem' && value === 'relevance')) next.delete(key)
    else next.set(key, value)
    if (key === 'uf' && value !== 'all') {
      const selectedMunicipality = municipalityOptions.find((option) => option.code === municipality)
      if (selectedMunicipality && selectedMunicipality.uf !== value) next.delete('municipio')
    }
    if (key !== 'pagina') next.delete('pagina')
    setSearchParams(next)
  }

  const clearFilters = () => setSearchParams({})

  return (
    <div className="page explore-page">
      <section className="page-hero explore-hero">
        <div className="container page-hero-grid">
          <div>
            <p className="kicker light"><MapIcon size={15} /> Radar nacional auditável</p>
            <h1>Encontre concursos confirmados sem esconder a cobertura real.</h1>
            <p>
              Pesquise por cargo, órgão, banca, área ou localidade. Prazos e mudanças de fase são
              recalculados pelas datas oficiais, e cada registro mantém sua origem e verificação.
            </p>
          </div>
          <div className="coverage-card">
            <span className="coverage-icon"><Sparkles size={20} /></span>
            <div>
              <strong>{catalog?.meta.mode === 'fallback'
                ? 'Modo de contingência: snapshot embarcado'
                : radarHealth?.enabled
                  ? radarHealth.status === 'degraded'
                    ? 'Radar automático municipal com alerta'
                    : radarHealth.status === 'running'
                      ? 'Radar automático atualizando agora'
                      : 'Radar automático municipal ativo'
                : catalog?.meta.automaticUpdates
                  ? catalog.meta.failedFeeds
                    ? 'Sincronização automática com alerta'
                    : 'Sincronização automática ativa'
                  : 'Curadoria oficial com atualização de prazos'}</strong>
              <p>
                {catalog
                  ? `${catalog.meta.total} seleções publicadas · ${catalog.meta.municipalitiesWithPublishedRecords} municípios e ${catalog.meta.regionalUnitsCovered} UFs com registros${radarHealth?.enabled ? ` · ${radarHealth.store.pendingEvents} sinais aguardando verificação` : ''}.`
                  : 'Lendo a cobertura e a saúde das fontes conectadas.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {catalog && (
        <section className="container catalog-integrity-strip" aria-label="Integridade do catálogo">
          <div><ShieldCheck size={19} /><span><strong>{catalog.meta.active}</strong> seleções ativas</span></div>
          <div><Activity size={19} /><span><strong>{catalog.meta.total}</strong> registros oficiais</span></div>
          <div><RefreshCw size={19} /><span>Última verificação: <strong>{formatDate(catalog.meta.newestVerification)}</strong></span></div>
          <div className={catalog.meta.stale || catalog.meta.failedFeeds || catalog.meta.mode === 'fallback' ? 'integrity-warning' : ''}>
            {catalog.meta.stale || catalog.meta.failedFeeds || catalog.meta.mode === 'fallback' ? <AlertTriangle size={19} /> : <ShieldCheck size={19} />}
            <span>
              {catalog.meta.mode === 'fallback'
                ? <>API indisponível; exibindo o último catálogo embarcado</>
                : catalog.meta.failedFeeds
                ? <><strong>{catalog.meta.failedFeeds}</strong> feeds com falha; último catálogo preservado</>
                : <><strong>{catalog.meta.stale}</strong> registros pedindo nova conferência</>}
            </span>
          </div>
          <Link to="/metodologia">Como a cobertura funciona</Link>
        </section>
      )}

      <section className="container catalog-layout" aria-label="Catálogo de concursos">
        <aside className="filter-panel">
          <div className="filter-title">
            <span><SlidersHorizontal size={18} /> Filtros</span>
            {activeFilterCount > 0 && <button type="button" onClick={clearFilters}>Limpar</button>}
          </div>

          <div className="filter-group">
            <label htmlFor="uf-filter">Localização exata</label>
            <select id="uf-filter" value={uf} onChange={(event) => updateParam('uf', event.target.value)}>
              <option value="all">Todos os locais ({facetCount({ uf: 'all' })})</option>
              {Object.entries(locationNames).map(([value, label]) => {
                const count = facetCount({ uf: value })
                return <option value={value} key={value} disabled={count === 0}>{label} ({count})</option>
              })}
            </select>
            <small>Escolher um estado não mistura concursos de abrangência nacional.</small>
          </div>

          <div className="filter-group">
            <label htmlFor="municipality-filter">Município</label>
            <select
              id="municipality-filter"
              value={municipality}
              onChange={(event) => updateParam('municipio', event.target.value)}
            >
              <option value="all">Todos os municípios ({facetCount({ municipality: 'all' })})</option>
              {municipalityOptions.map((option) => {
                const count = facetCount({ municipality: option.code })
                return (
                  <option value={option.code} key={option.code} disabled={count === 0}>
                    {option.name} — {option.uf} ({count})
                  </option>
                )
              })}
            </select>
            <small>A lista mostra municípios que já possuem registros publicados.</small>
          </div>

          <div className="filter-group">
            <label htmlFor="phase-filter">Situação</label>
            <select id="phase-filter" value={phase} onChange={(event) => updateParam('status', event.target.value)}>
              {phases.map((item) => {
                const count = phaseCount(item)
                const label = item === 'all'
                  ? 'Todas as situações'
                  : item === 'preparation'
                    ? 'Em preparação'
                    : phaseLabels[item]
                return <option value={item} key={item} disabled={item !== 'all' && count === 0}>{label} ({count})</option>
              })}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="education-filter">Escolaridade</label>
            <select id="education-filter" value={education} onChange={(event) => updateParam('escolaridade', event.target.value)}>
              <option value="all">Todas ({facetCount({ education: 'all' })})</option>
              {educationOptions.map((item) => {
                const count = facetCount({ education: item })
                return <option value={item} key={item} disabled={count === 0}>{item} ({count})</option>
              })}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="government-level-filter">Esfera</label>
            <select id="government-level-filter" value={governmentLevel} onChange={(event) => updateParam('esfera', event.target.value)}>
              {governmentLevels.map((item) => {
                const count = facetCount({ governmentLevel: item })
                return <option value={item} key={item} disabled={item !== 'all' && count === 0}>{item === 'all' ? 'Todas as esferas' : item} ({count})</option>
              })}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="area-filter">Área</label>
            <select id="area-filter" value={area} onChange={(event) => updateParam('area', event.target.value)}>
              <option value="all">Todas as áreas ({facetCount({ area: 'all' })})</option>
              {areaOptions.map((item) => {
                const count = facetCount({ area: item })
                return <option value={item} key={item} disabled={count === 0}>{item} ({count})</option>
              })}
            </select>
          </div>

          <div className="filter-explainer">
            <Filter size={18} />
            <p><strong>O que é “em preparação”?</strong> Reúne concurso autorizado, comissão formada, banca definida ou sinal oficial previsto — cada subetapa continua identificada no card.</p>
          </div>
        </aside>

        <div className="catalog-content">
          <SearchForm key={query} initialQuery={query} onSearch={(value) => updateParam('q', value)} />

          <div className="catalog-toolbar">
            <div>
              <p className="eyebrow">Seleções verificadas</p>
              <h2>{catalog ? `${contests.length} de ${catalog.meta.total} registros encontrados` : 'Buscando concursos…'}</h2>
            </div>
            <div className="catalog-toolbar-actions">
              <label htmlFor="sort-filter">Ordenar por</label>
              <select id="sort-filter" value={sort} onChange={(event) => updateParam('ordem', event.target.value)}>
                <option value="relevance">Destaques e situação</option>
                <option value="recent">Verificação mais recente</option>
                <option value="deadline">Inscrição terminando primeiro</option>
                <option value="title">Nome do concurso</option>
              </select>
              <span className="active-filter-count">{activeFilterCount} filtros ativos</span>
            </div>
          </div>

          <div className="sr-only" aria-live="polite">
            {catalog && `${contests.length} resultados encontrados`}
          </div>

          {!catalog ? (
            <div className="contest-grid catalog-grid" aria-label="Carregando resultados">
              {[1, 2, 3, 4].map((item) => <div className="skeleton-card" key={item} />)}
            </div>
          ) : contests.length > 0 ? (
            <>
              <div className="contest-grid catalog-grid">
                {visibleContests.map((contest) => <ContestCard key={contest.id} contest={contest} />)}
              </div>
              {totalPages > 1 && (
                <nav className="catalog-pagination" aria-label="Paginação do catálogo">
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => updateParam('pagina', String(currentPage - 1))}
                  >Anterior</button>
                  <span>Página <strong>{currentPage}</strong> de {totalPages}</span>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => updateParam('pagina', String(currentPage + 1))}
                  >Próxima</button>
                </nav>
              )}
            </>
          ) : (
            <div className="empty-state">
              <span><Search size={28} /></span>
              <h2>Nenhum concurso encontrado</h2>
              <p>Os filtros agora são exatos. Retire uma condição ou tente um termo mais amplo.</p>
              <button className="button button-secondary" type="button" onClick={clearFilters}>Limpar filtros</button>
            </div>
          )}
          {catalog && <CatalogSuggestion />}
        </div>
      </section>
    </div>
  )
}
