import {
  ArrowRight,
  BookOpenCheck,
  ChevronRight,
  CircleCheckBig,
  Compass,
  FileCheck2,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { CatalogMeta, Contest } from '../entities/contest/types'
import { contestRepository } from '../data/repositories/contestRepository'
import { ContestCard } from '../shared/ui/ContestCard'

const suggestions: Array<{ label: string; params: Record<string, string> }> = [
  { label: 'Bombeiros RJ', params: { q: 'Bombeiros RJ' } },
  { label: 'Nível médio no RJ', params: { escolaridade: 'Nível médio', uf: 'RJ' } },
  { label: 'Área fiscal', params: { q: 'fiscal' } },
  { label: 'Concursos federais', params: { esfera: 'Federal' } },
]

const journey = [
  {
    number: '01',
    icon: Compass,
    title: 'Descubra',
    description: 'Encontre oportunidades por objetivo, região e perfil — mesmo sem saber o nome do cargo.',
  },
  {
    number: '02',
    icon: FileCheck2,
    title: 'Entenda',
    description: 'Veja o que é oficial, histórico ou apenas previsto, sempre com a origem da informação.',
  },
  {
    number: '03',
    icon: Target,
    title: 'Planeje',
    description: 'Transforme conteúdo, peso da prova e tempo disponível em uma semana possível de cumprir.',
  },
  {
    number: '04',
    icon: CircleCheckBig,
    title: 'Evolua',
    description: 'Registre sessões, revise no momento certo e ajuste prioridades conforme seu desempenho.',
  },
]

export function HomePage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [featured, setFeatured] = useState<Contest[]>([])
  const [catalogMeta, setCatalogMeta] = useState<CatalogMeta | null>(null)

  useEffect(() => {
    void contestRepository.getFeatured().then(setFeatured)
    void contestRepository.getCatalog().then((catalog) => setCatalogMeta(catalog.meta))
  }, [])

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    navigate(`/concursos${params.size ? `?${params.toString()}` : ''}`)
  }

  const chooseSuggestion = (suggestion: (typeof suggestions)[number]) => {
    setQuery(suggestion.label)
    navigate(`/concursos?${new URLSearchParams(suggestion.params).toString()}`)
  }

  const latestVerificationLabel = catalogMeta?.newestVerification
    ? `Verificado em ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${catalogMeta.newestVerification}T12:00:00`))}`
    : 'Carregando fontes'

  return (
    <>
      <section className="hero section">
        <div className="hero-grid-pattern" aria-hidden="true" />
        <div className="container hero-grid">
          <div className="hero-copy reveal">
            <p className="kicker"><Sparkles size={15} /> Preparação com contexto, não com promessas</p>
            <h1>
              Seu próximo cargo começa com um <span>plano claro.</span>
            </h1>
            <p className="hero-lead">
              Descubra concursos de todas as regiões, entenda cada etapa e receba um plano de estudos
              construído para a sua rotina.
            </p>

            <form className="hero-search" onSubmit={submitSearch} role="search">
              <label htmlFor="hero-query">Qual concurso você quer conquistar?</label>
              <div className="hero-search-control">
                <Search size={21} aria-hidden="true" />
                <input
                  id="hero-query"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ex.: Bombeiros RJ ou cargo de nível médio"
                />
                <button className="button button-accent" type="submit">
                  Encontrar meu caminho <ArrowRight size={18} />
                </button>
              </div>
              <div className="search-suggestions" aria-label="Sugestões de busca">
                <span>Tente:</span>
                {suggestions.map((suggestion) => (
                  <button key={suggestion.label} type="button" onClick={() => chooseSuggestion(suggestion)}>
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </form>

            <div className="trust-row" aria-label="Compromissos do produto">
              <span><ShieldCheck size={17} /> Fonte por informação</span>
              <span><BookOpenCheck size={17} /> Histórico contextualizado</span>
              <span><Target size={17} /> Plano explicável</span>
            </div>
          </div>

          <aside className="radar-panel reveal reveal-delay" aria-label="Radar de oportunidades verificadas">
            <div className="radar-orbit radar-orbit-one" aria-hidden="true" />
            <div className="radar-orbit radar-orbit-two" aria-hidden="true" />
            <div className="radar-panel-header">
              <div>
                <p className="eyebrow light">Radar de oportunidades</p>
                <h2>O que está em movimento</h2>
              </div>
              <span className="live-indicator">{latestVerificationLabel}</span>
            </div>
            <div className="radar-list">
              {featured.map((contest, index) => (
                <Link to={`/concursos/${contest.slug}`} key={contest.id} className="radar-item">
                  <span className="radar-index">0{index + 1}</span>
                  <span>
                    <strong>{contest.acronym}</strong>
                    <small>{contest.title}</small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              ))}
            </div>
            <Link className="radar-all-link" to="/concursos">
              Explorar o radar completo <ArrowRight size={17} />
            </Link>
          </aside>
        </div>
      </section>

      <section className="signal-strip" aria-label="Pilares do projeto">
        <div className="container signal-grid">
          <div><strong>Brasil</strong><span>concursos de diferentes regiões</span></div>
          <div><strong>Fonte à vista</strong><span>cada fato com origem e verificação</span></div>
          <div><strong>Pré-edital seguro</strong><span>histórico nunca se passa por atual</span></div>
          <div><strong>Plano vivo</strong><span>rotina que se adapta ao desempenho</span></div>
        </div>
      </section>

      <section className="status-entry-section" aria-labelledby="status-entry-title">
        <div className="container status-entry-grid">
          <div>
            <p className="kicker">Radar por situação</p>
            <h2 id="status-entry-title">Vá direto ao momento que importa.</h2>
          </div>
          <nav className="status-entry-actions" aria-label="Atalhos do catálogo">
            <Link to="/concursos?status=registration_open"><span className="status-dot open" /> Inscrições abertas <ArrowRight size={16} /></Link>
            <Link to="/concursos?status=notice_published"><span className="status-dot notice" /> Editais publicados <ArrowRight size={16} /></Link>
            <Link to="/concursos?status=preparation"><span className="status-dot expected" /> Em preparação <ArrowRight size={16} /></Link>
            <Link to="/provas-anteriores"><span className="status-dot previous" /> Provas anteriores <ArrowRight size={16} /></Link>
          </nav>
        </div>
      </section>

      <section className="section featured-section">
        <div className="container">
          <div className="section-heading split-heading">
            <div>
              <p className="kicker">Concursos em movimento</p>
              <h2>Comece pela oportunidade certa.</h2>
            </div>
            <div className="heading-aside">
              <p>Informações conferidas em editais e páginas oficiais em 12/08/2026.</p>
              <Link className="text-link" to="/concursos">Ver todos <ArrowRight size={16} /></Link>
            </div>
          </div>
          <div className="contest-grid home-contest-grid">
            {featured.map((contest) => <ContestCard key={contest.id} contest={contest} />)}
          </div>
        </div>
      </section>

      <section className="section journey-section" id="como-funciona">
        <div className="container">
          <div className="section-heading centered-heading">
            <p className="kicker">Uma jornada completa</p>
            <h2>Da descoberta à evolução, sem perder o contexto.</h2>
            <p>Uma experiência contínua para quem ainda procura uma oportunidade e para quem já está estudando.</p>
          </div>
          <div className="journey-grid">
            {journey.map(({ number, icon: Icon, title, description }) => (
              <article className="journey-card" key={number}>
                <span className="journey-number">{number}</span>
                <span className="journey-icon"><Icon size={23} /></span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section plan-preview-section">
        <div className="container plan-preview-grid">
          <div className="plan-preview-copy">
            <p className="kicker light">Planejamento adaptativo</p>
            <h2>Um plano que explica por que cada matéria está ali.</h2>
            <p>
              A distribuição combina a prioridade documentada no catálogo, sua familiaridade com cada
              disciplina e as horas realmente disponíveis na semana.
            </p>
            <ul className="check-list">
              <li><CircleCheckBig /> Prioridades reproduzíveis e transparentes</li>
              <li><CircleCheckBig /> Blocos de teoria, questões e revisão</li>
              <li><CircleCheckBig /> Documento oficial usado identificado no plano</li>
            </ul>
            <Link className="button button-accent" to="/planejamento/novo">
              Criar meu primeiro plano <ArrowRight size={18} />
            </Link>
          </div>
          <div className="week-card" aria-label="Exemplo de plano semanal">
            <div className="week-card-header">
              <div><span>SEMANA 01</span><strong>Seu ritmo inicial</strong></div>
              <span className="week-hours">8h / semana</span>
            </div>
            {[
              ['SEG', 'Língua Portuguesa', 'Teoria + resumo', '50 min'],
              ['TER', 'Conhecimentos Específicos', 'Questões', '50 min'],
              ['QUA', 'Raciocínio Lógico', 'Teoria + resumo', '50 min'],
              ['QUI', 'Direito Constitucional', 'Revisão ativa', '40 min'],
            ].map(([day, subject, kind, time], index) => (
              <div className="week-session" key={day}>
                <span className={`session-dot dot-${index + 1}`} />
                <strong>{day}</strong>
                <span><b>{subject}</b><small>{kind}</small></span>
                <time>{time}</time>
              </div>
            ))}
            <div className="week-card-footer">
              <Sparkles size={16} /> Visualização do formato do plano de estudos
            </div>
          </div>
        </div>
      </section>

      <section className="section final-cta-section">
        <div className="container final-cta">
          <span className="cta-compass"><Compass size={32} /></span>
          <div>
            <p className="kicker light">Seu próximo passo</p>
            <h2>Você não precisa esperar o edital para começar direito.</h2>
          </div>
          <Link className="button button-accent" to="/concursos">
            Explorar concursos <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  )
}
