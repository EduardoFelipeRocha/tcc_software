import {
  ArrowRight,
  BookOpenCheck,
  Check,
  Database,
  ExternalLink,
  FileClock,
  Fingerprint,
  Scale,
  ShieldCheck,
  Waypoints,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const statusGroups = [
  ['Inscrições abertas', 'Existe edital vigente e a janela de inscrição está aberta.'],
  ['Edital publicado', 'O documento oficial existe; as inscrições podem ainda não ter começado.'],
  ['Em preparação', 'Inclui autorização, comissão ou contratação de banca comprovada por ato.'],
  ['Previsto', 'Há um sinal oficial de intenção, mas não há confirmação de edital.'],
  ['Em andamento', 'As inscrições terminaram, porém provas, recursos ou resultados ainda ocorrem.'],
]

const officialSources = [
  {
    name: 'MGI — Autorizações e provimentos',
    scope: 'Executivo federal',
    url: 'https://www.gov.br/gestao/pt-br/acesso-a-informacao/servidores/concursos-publicos/autorizacoes-e-provimentos',
  },
  {
    name: 'Diário Oficial da União',
    scope: 'Atos e editais federais',
    url: 'https://www.in.gov.br/consulta/-/buscar/dou',
  },
  {
    name: 'IOERJ — Diário Oficial do Estado',
    scope: 'Estado do Rio de Janeiro',
    url: 'https://www.ioerj.com.br/portal/modules/conteudoonline/busca_do.php?acao=busca',
  },
  {
    name: 'Portal de Concursos do Rio',
    scope: 'Município do Rio de Janeiro',
    url: 'https://www.rio.rj.gov.br/web/portaldeconcursos/home',
  },
]

export function MethodologyPage() {
  return (
    <div className="page methodology-page">
      <section className="methodology-hero">
        <div className="container methodology-hero-grid">
          <div>
            <p className="kicker light"><Fingerprint size={15} /> Transparência por construção</p>
            <h1>Confiança não é um selo. É conseguir conferir o caminho do dado.</h1>
            <p>
              A Rumo foi desenhada para diferenciar documento, fato histórico e projeção — e explicar como
              cada um influencia o plano de estudos.
            </p>
          </div>
          <div className="method-principle-card">
            <Scale size={26} />
            <strong>Regra central do produto</strong>
            <p>Sem fonte revisada, a informação não vira orientação de inscrição, pagamento ou elegibilidade.</p>
          </div>
        </div>
      </section>

      <section className="section container methodology-content">
        <div className="section-heading">
          <p className="kicker">Situação do concurso</p>
          <h2>“Ativo” é amplo demais. Nós mostramos a etapa real.</h2>
          <p>O estado exibido será calculado a partir de eventos documentados, sem apagar o histórico anterior.</p>
        </div>
        <div className="status-method-grid">
          {statusGroups.map(([title, description], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="section evidence-section">
        <div className="container evidence-grid">
          <div className="section-heading">
            <p className="kicker light">Rastreabilidade</p>
            <h2>Cada informação carrega sua própria evidência.</h2>
            <p>Uma retificação pode mudar a data sem mudar o restante do edital. Por isso, a origem pertence ao campo, não apenas à página.</p>
          </div>
          <div className="evidence-flow" aria-label="Fluxo de validação da informação">
            <div><span><Database size={20} /></span><strong>Coleta</strong><small>Fonte monitorada</small></div>
            <ArrowRight size={18} />
            <div><span><FileClock size={20} /></span><strong>Versão</strong><small>Documento e data</small></div>
            <ArrowRight size={18} />
            <div><span><ShieldCheck size={20} /></span><strong>Revisão</strong><small>Validação humana</small></div>
            <ArrowRight size={18} />
            <div><span><BookOpenCheck size={20} /></span><strong>Publicação</strong><small>Fato contextualizado</small></div>
          </div>
        </div>
      </section>

      <section className="section container source-section">
        <div className="source-section-grid">
          <div>
            <p className="kicker">Cobertura progressiva</p>
            <h2>Produto nacional, conectores por jurisdição.</h2>
            <p>
              Não existe uma fonte única para todos os concursos brasileiros. O MVP começa pelo Executivo
              federal, Estado do RJ e Município do Rio, deixando lacunas visíveis em vez de fingir cobertura total.
            </p>
            <ul className="check-list dark-check-list">
              <li><Check /> Fontes privadas servem como pista, não como confirmação</li>
              <li><Check /> Retificações criam novas versões do documento</li>
              <li><Check /> Botão de inscrição exige domínio oficial validado</li>
              <li><Check /> Taxa histórica sempre mostra ano e edição</li>
            </ul>
          </div>
          <div className="official-source-list">
            <p className="eyebrow">Fontes iniciais planejadas</p>
            {officialSources.map((source) => (
              <a href={source.url} key={source.name} target="_blank" rel="noreferrer">
                <span><strong>{source.name}</strong><small>{source.scope}</small></span>
                <ExternalLink size={16} />
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section algorithm-section">
        <div className="container algorithm-grid">
          <div className="algorithm-card">
            <Waypoints size={24} />
            <p className="eyebrow light">Algoritmo v1.0</p>
            <code>prioridade = peso histórico × (1 + lacuna)</code>
            <p>O mesmo conjunto de respostas sempre produz a mesma distribuição inicial.</p>
          </div>
          <div>
            <p className="kicker">Plano explicável</p>
            <h2>A IA pode ajudar depois. A regra principal precisa ser auditável agora.</h2>
            <p>
              No protótipo, a rotina usa um cálculo determinístico baseado no peso demonstrativo das matérias
              e no nível informado. No produto real, os pesos virão da prova anterior validada.
            </p>
            <Link className="button button-primary" to="/planejamento/novo">Testar o planejamento <ArrowRight size={17} /></Link>
          </div>
        </div>
      </section>
    </div>
  )
}
