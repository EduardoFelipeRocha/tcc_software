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
  ['Em andamento', 'As inscrições terminaram, porém provas, recursos, resultados ou homologação ainda estão em curso.'],
  ['Encerrado / histórico', 'A seleção saiu do radar ativo, mas edital, prova e gabarito continuam disponíveis quando oficiais.'],
]

const officialSources = [
  {
    name: 'MGI — Autorizações e provimentos',
    scope: 'Executivo federal',
    url: 'https://www.gov.br/servidor/pt-br/observatorio-de-pessoal-govbr/autorizacoes-e-provimentos-concursos',
  },
  {
    name: 'INLABS — Imprensa Nacional',
    scope: 'XML e PDF diários do DOU',
    url: 'https://inlabs.in.gov.br/acessar.php',
  },
  {
    name: 'Dados Abertos da Imprensa Nacional',
    scope: 'Backfill dos atos publicados no DOU',
    url: 'https://www.gov.br/imprensanacional/pt-br/acesso-a-informacao/dados-abertos',
  },
  {
    name: 'Querido Diário — radar municipal',
    scope: 'Descoberta automática; sinais ficam pendentes até validação',
    url: 'https://docs.queridodiario.ok.org.br/pt-br/latest/utilizando/api-publica.html',
  },
  {
    name: 'IBGE — códigos dos municípios',
    scope: 'Identidade territorial; não é uma base de concursos',
    url: 'https://servicodados.ibge.gov.br/api/docs/localidades',
  },
  {
    name: 'PNCP — sinal de contratação de banca',
    scope: 'Pista oficial; nunca tratado como edital',
    url: 'https://pncp.gov.br/app/buscar/editais',
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
              A plataforma GuiaConcursos foi desenhada para diferenciar documento, fato histórico e projeção — e explicar como
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
          <p>O estado exibido combina o evento documentado com a janela oficial de inscrições; início e encerramento mudam automaticamente pela data, sem apagar o histórico.</p>
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
              Não existe uma fonte única para todos os concursos brasileiros. A cobertura atual reúne uma
              seleção multirregional conferida em fontes primárias. O radar municipal procura novos atos
              automaticamente e os mantém pendentes até a etapa e a evidência serem validadas. Feeds
              estruturados publicam as atualizações aprovadas sem exigir um novo build do site.
            </p>
            <ul className="check-list dark-check-list">
              <li><Check /> Filtros, totais, UFs cobertas e registros desatualizados ficam visíveis</li>
              <li><Check /> Falha de um conector nunca apaga o último catálogo válido</li>
              <li><Check /> Fontes privadas servem como pista, não como confirmação</li>
              <li><Check /> Retificações criam novas versões do documento</li>
              <li><Check /> Extração automática descobre; fatos críticos exigem evidência oficial</li>
              <li><Check /> Indicações da comunidade recebem protocolo e entram na fila de revisão</li>
            </ul>
          </div>
          <div className="official-source-list">
            <p className="eyebrow">Fontes e radares de referência</p>
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
            <code>prioridade = base documentada × (1 + lacuna)</code>
            <p>O mesmo conjunto de respostas sempre produz a mesma distribuição inicial.</p>
          </div>
          <div>
            <p className="kicker">Plano explicável</p>
            <h2>A IA pode ajudar depois. A regra principal precisa ser auditável agora.</h2>
            <p>
              Quando existe distribuição oficial, ela fundamenta o cálculo. Se o documento só trouxer o
              conteúdo, qualquer divisão equilibrada será identificada como tal. Cards que misturam cargos
              diferentes ficam bloqueados até a seleção do cargo, evitando uma trilha genérica enganosa.
            </p>
            <Link className="button button-primary" to="/planejamento/novo">Testar o planejamento <ArrowRight size={17} /></Link>
          </div>
        </div>
      </section>
    </div>
  )
}
