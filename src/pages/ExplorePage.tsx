import { Filter, Map, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { contestRepository } from '../data/repositories/contestRepository'
import { phaseLabels } from '../entities/contest/labels'
import type { Contest, ContestPhase } from '../entities/contest/types'
import { ContestCard } from '../shared/ui/ContestCard'

const phases: Array<ContestPhase | 'all'> = [
  'all',
  'registration_open',
  'notice_published',
  'organizer_selected',
  'committee_formed',
  'authorized',
  'expected',
]

const phaseOptions = new Set<string>(phases)

export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [queryInput, setQueryInput] = useState(searchParams.get('q') ?? '')
  const [contests, setContests] = useState<Contest[]>([])
  const [loading, setLoading] = useState(true)

  const query = searchParams.get('q') ?? ''
  const uf = searchParams.get('uf') ?? 'all'
  const phaseParam = searchParams.get('status') ?? 'all'
  const phase = (phaseOptions.has(phaseParam) ? phaseParam : 'all') as ContestPhase | 'all'
  const education = searchParams.get('escolaridade') ?? 'all'

  useEffect(() => {
    let active = true

    void contestRepository
      .list({ query, uf, phase, education })
      .then((results) => {
        if (active) setContests(results)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [education, phase, query, uf])

  const activeFilterCount = useMemo(
    () => [query, uf !== 'all', phase !== 'all', education !== 'all'].filter(Boolean).length,
    [education, phase, query, uf],
  )

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setSearchParams(next)
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    updateParam('q', queryInput.trim())
  }

  const clearFilters = () => {
    setQueryInput('')
    setSearchParams({})
  }

  return (
    <div className="page explore-page">
      <section className="page-hero explore-hero">
        <div className="container page-hero-grid">
          <div>
            <p className="kicker light"><Map size={15} /> Radar nacional</p>
            <h1>Encontre a oportunidade que combina com o seu momento.</h1>
            <p>
              Pesquise por cargo, órgão ou área e filtre o caminho. No protótipo, os resultados abaixo
              demonstram a experiência e ainda não representam concursos atuais.
            </p>
          </div>
          <div className="coverage-card">
            <span className="coverage-icon"><Sparkles size={20} /></span>
            <div>
              <strong>Cobertura oficial progressiva</strong>
              <p>União e RJ serão os primeiros conectores; outras regiões entram por fontes validadas.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container catalog-layout" aria-label="Catálogo de concursos">
        <aside className="filter-panel">
          <div className="filter-title">
            <span><SlidersHorizontal size={18} /> Filtros</span>
            {activeFilterCount > 0 && (
              <button type="button" onClick={clearFilters}>Limpar</button>
            )}
          </div>

          <div className="filter-group">
            <label htmlFor="uf-filter">Localização</label>
            <select id="uf-filter" value={uf} onChange={(event) => updateParam('uf', event.target.value)}>
              <option value="all">Brasil inteiro</option>
              <option value="RJ">Rio de Janeiro</option>
              <option value="SP">São Paulo</option>
              <option value="MG">Minas Gerais</option>
              <option value="ES">Espírito Santo</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="phase-filter">Situação</label>
            <select
              id="phase-filter"
              value={phase}
              onChange={(event) => updateParam('status', event.target.value)}
            >
              {phases.map((item) => (
                <option value={item} key={item}>
                  {item === 'all' ? 'Todas as situações' : phaseLabels[item]}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="education-filter">Escolaridade</label>
            <select
              id="education-filter"
              value={education}
              onChange={(event) => updateParam('escolaridade', event.target.value)}
            >
              <option value="all">Todas</option>
              <option value="Nível médio">Nível médio</option>
              <option value="Nível superior">Nível superior</option>
            </select>
          </div>

          <div className="filter-explainer">
            <Filter size={18} />
            <p><strong>O que significa “previsto”?</strong> Existe um sinal a monitorar, mas ainda não há autorização ou edital confirmado.</p>
          </div>
        </aside>

        <div className="catalog-content">
          <form className="catalog-search" role="search" onSubmit={submitSearch}>
            <Search size={20} aria-hidden="true" />
            <label className="sr-only" htmlFor="catalog-query">Buscar concursos</label>
            <input
              id="catalog-query"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Cargo, órgão, área ou estado"
            />
            {queryInput && (
              <button className="clear-search" type="button" aria-label="Limpar busca" onClick={() => setQueryInput('')}>
                <X size={17} />
              </button>
            )}
            <button className="button button-primary" type="submit">Buscar</button>
          </form>

          <div className="catalog-toolbar">
            <div>
              <p className="eyebrow">Resultados demonstrativos</p>
              <h2>{loading ? 'Buscando cenários…' : `${contests.length} oportunidades encontradas`}</h2>
            </div>
            <span className="active-filter-count">{activeFilterCount} filtros ativos</span>
          </div>

          <div className="sr-only" aria-live="polite">
            {!loading && `${contests.length} resultados encontrados`}
          </div>

          {loading ? (
            <div className="contest-grid catalog-grid" aria-label="Carregando resultados">
              {[1, 2, 3, 4].map((item) => <div className="skeleton-card" key={item} />)}
            </div>
          ) : contests.length > 0 ? (
            <div className="contest-grid catalog-grid">
              {contests.map((contest) => <ContestCard key={contest.id} contest={contest} />)}
            </div>
          ) : (
            <div className="empty-state">
              <span><Search size={28} /></span>
              <h2>Nenhum cenário encontrado</h2>
              <p>Tente retirar algum filtro ou buscar por uma área mais ampla.</p>
              <button className="button button-secondary" type="button" onClick={clearFilters}>Limpar filtros</button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
