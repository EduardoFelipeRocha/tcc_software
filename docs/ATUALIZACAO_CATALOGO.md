# Atualização contínua do catálogo

## Compromisso correto

Não existe um cadastro oficial único que reúna concursos da União, dos 26 estados, do Distrito Federal, dos municípios, dos Poderes, dos órgãos autônomos e das empresas públicas. Por isso, o produto não promete uma cobertura nacional absoluta que não possa ser auditada.

O compromisso operacional é verificável:

- monitorar automaticamente cada fonte conectada;
- publicar somente fatos ligados a evidências oficiais;
- mostrar data de verificação, alcance geográfico e registros que precisam de nova conferência;
- manter o último snapshot válido quando uma fonte falhar;
- registrar lacunas de cobertura em vez de escondê-las;
- nunca transformar contratação de banca, orçamento ou expectativa em edital publicado.

## Fontes e camadas

1. **Federal:** INLABS e dados abertos da Imprensa Nacional para DOU; planilhas de autorizações e provimentos do MGI.
2. **Sinais oficiais:** PNCP e Compras.gov.br apenas para descobrir contratação de banca. Esses eventos não comprovam vagas, prazo ou publicação de edital.
3. **Regional:** conectores versionados para diários estaduais, municipais e páginas institucionais.
4. **Bancas:** páginas oficiais para corroborar cronograma, arquivos e inscrições, respeitando termos de uso e limites de acesso.
5. **Comunidade:** uma sugestão de usuário entra em revisão; nunca é publicada diretamente.

Fontes de partida:

- INLABS: https://inlabs.in.gov.br/acessar.php
- Dados abertos da Imprensa Nacional: https://www.gov.br/imprensanacional/pt-br/acesso-a-informacao/dados-abertos
- Autorizações e provimentos do MGI: https://www.gov.br/servidor/pt-br/observatorio-de-pessoal-govbr/autorizacoes-e-provimentos-concursos
- PNCP: https://pncp.gov.br/app/buscar/editais
- API de dados abertos Compras.gov.br: https://dadosabertos.compras.gov.br/swagger-ui/index.html

## Por que não existe uma “API com todos”

Concurso público não é publicado por um único sistema nacional. União, estados,
municípios, tribunais, universidades, conselhos, empresas públicas e bancas usam
portais e diários diferentes. Uma API que lista somente inscrições abertas também
não encontra fases anteriores, como anúncio, autorização, comissão e escolha de banca.

A cobertura profissional precisa combinar fontes com papéis diferentes:

| Fonte | Papel seguro | Limite conhecido |
|---|---|---|
| INLABS / DOU | Evidência primária federal | Não cobre DOE nem DOM |
| MGI | Autorizações do Executivo federal | Não cobre outros Poderes e entes |
| Querido Diário | Radar textual de diários municipais | Ainda não alcança todos os 5.570 municípios e não entrega concursos estruturados |
| PNCP / Compras.gov.br | Sinal de contratação de banca | Uma licitação não prova edital, vagas ou inscrições |
| PCI Concursos | Reconciliação de editais e inscrições abertas | Pode não conter todos os editais e não cobre bem anúncios futuros |
| Adoo ou serviço equivalente | Monitoramento comercial de DOU, DOE e DOM | Exige contrato, não normaliza sozinho os fatos de um concurso |
| Portais oficiais de órgãos e bancas | Confirmação de edital, retificação e cronograma | Cada portal exige conector e monitoramento próprios |
| Indicações de usuários | Descoberta de uma lacuna concreta | Sempre entra pendente; nunca publica diretamente |

Portais editoriais sem licença de redistribuição não devem ser raspados para criar uma
base concorrente. Eles podem servir como pista somente quando os termos permitirem e o
fato for confirmado na fonte oficial.

O compromisso público correto é: **cada card tem fonte, etapa e data de verificação
auditáveis**. Não se promete “100% do Brasil” sem conseguir medir e provar essa cobertura.

## Fluxo de publicação

```text
fonte conectada
  -> coleta incremental com cache/retry
  -> documento bruto + SHA-256 + data de coleta
  -> extração de eventos e campos
  -> deduplicação por órgão + edital + ano + hash
  -> revisão dos fatos críticos
  -> feed estruturado e, opcionalmente, assinado
  -> API GuiaConcursos
  -> site
```

Extração automática pode sugerir um registro. Edital, retificação, suspensão, cancelamento, prazo, salário, taxa, requisito e conteúdo programático exigem evidência oficial. O plano de estudo só é liberado quando o anexo exato do cargo foi validado.

## O que o servidor já faz

- `GET /api/catalog`: entrega o catálogo atual e metadados de cobertura/saúde.
- `GET /api/catalog/health`: informa total, registros ativos, registros vencidos e saúde dos feeds.
- `GET /api/catalog/radar/health`: expõe somente métricas do radar municipal, sem publicar os textos pendentes.
- radar automático do Querido Diário com busca de atos de alto sinal, código IBGE, hash, deduplicação e quarentena por item;
- `POST /api/catalog/suggestions`: recebe lacunas apontadas por usuários, devolve protocolo e não acessa a URL submetida;
- filas de radar e indicações acessíveis somente com `CATALOG_REVIEW_TOKEN`;
- atualização periódica configurável, com intervalo mínimo de cinco minutos;
- ETag e `Last-Modified` para não baixar conteúdo sem mudança;
- timeout, limite de 25 MB e validação estrita antes da publicação;
- rejeição de projeções e fontes não oficiais em feeds de publicação;
- exigência de URL, data de coleta e SHA-256 para cada evidência remota;
- HMAC opcional do corpo completo do feed;
- cache atômico e estratégia *last known good*;
- histórico cumulativo: retirar um item do snapshot de origem não apaga um concurso já publicado; a fonte deve enviar uma nova fase para encerramento, suspensão ou cancelamento;
- transição automática de “edital publicado” para “inscrições abertas” e de “inscrições abertas” para “em andamento”, usando as datas oficiais e o fuso de Brasília;
- atualização no navegador sem novo build, com cache curto de 60 segundos.

## Configuração

Copie `.env.example` para `.env` e configure pelo menos:

```dotenv
CATALOG_FEED_URLS=https://catalogo.exemplo.gov.br/guiaconcursos/v1/feed.json
CATALOG_REFRESH_MINUTES=15
CATALOG_REFRESH_TOKEN=um-segredo-longo-e-aleatorio
CATALOG_REVIEW_TOKEN=outro-segredo-longo-e-aleatorio
CATALOG_DISCOVERY_ENABLED=true
CATALOG_DISCOVERY_REFRESH_MINUTES=60
CATALOG_DISCOVERY_LOOKBACK_DAYS=30
```

Para um feed editorial próprio, configure também `CATALOG_FEED_HMAC_SECRET`. A resposta deve enviar:

```text
x-catalog-signature: sha256=<HMAC-SHA256 do corpo JSON exatamente como enviado>
```

Se o endpoint do feed for privado, use `CATALOG_FEED_BEARER_TOKEN`. Não coloque credenciais na URL; o token é enviado no cabeçalho `Authorization`.

O endpoint manual pode ser acionado por um cron externo:

```http
POST /api/catalog/refresh
Authorization: Bearer <CATALOG_REFRESH_TOKEN>
```

O próprio processo do servidor também atualiza os feeds no intervalo configurado. O endpoint existe para plataformas sem processo permanentemente ativo ou para webhooks após uma publicação editorial.

O radar municipal é complementar e vem habilitado fora do ambiente de teste. Ele lê somente
`api.queridodiario.ok.org.br`, recusa redirects, limita tempo e tamanho da resposta e grava
eventos `pending` em um log append-only. Configure `CATALOG_DISCOVERY_LOG_FILE` e
`CATALOG_SUGGESTIONS_FILE` em volume persistente. Em múltiplas réplicas, use Postgres ou
outro armazenamento transacional compartilhado; arquivos locais não oferecem coordenação
distribuída.

Rotas operacionais:

```http
GET /api/catalog/radar/events?uf=RJ&limit=100
Authorization: Bearer <CATALOG_REVIEW_TOKEN>

GET /api/catalog/suggestions?limit=100
Authorization: Bearer <CATALOG_REVIEW_TOKEN>

POST /api/catalog/radar/refresh
Authorization: Bearer <CATALOG_REFRESH_TOKEN>
```

O primeiro radar implementado não significa cobertura de todos os municípios. A métrica
`municipalitiesWithPublishedRecords` conta municípios com cards publicados; não deve ser
apresentada como municípios monitorados.

## Contrato do feed

O feed usa `schemaVersion: 1`:

```json
{
  "schemaVersion": 1,
  "provider": {
    "id": "editorial-oficial",
    "name": "Catálogo editorial",
    "homepage": "https://catalogo.exemplo.gov.br"
  },
  "generatedAt": "2026-08-14T15:00:00.000Z",
  "sources": [
    {
      "id": "orgao-edital-01-2026",
      "title": "Edital nº 01/2026",
      "publisher": "Órgão público",
      "url": "https://orgao.gov.br/edital-01-2026.pdf",
      "checkedAt": "2026-08-14",
      "official": true,
      "retrievedAt": "2026-08-14T14:55:00.000Z",
      "contentHash": "<sha256 hexadecimal de 64 caracteres>"
    }
  ],
  "contests": ["objeto Contest completo"]
}
```

Regras importantes:

- identificadores e slugs não podem se repetir;
- toda `sourceId` precisa existir e estar marcada como oficial;
- `officialUrl` precisa ser uma das evidências vinculadas;
- a evidência precisa ter sido conferida na data declarada pelo concurso;
- somente HTTPS é aceito em produção;
- o feed inteiro é rejeitado se um registro quebrar o contrato;
- uma versão mais antiga nunca substitui um registro mais novo;
- conteúdo de estudo local já validado é preservado quando um feed atualiza apenas a situação operacional do mesmo concurso.

## SLA recomendado para operação real

| Tipo | Varredura | Revisão humana máxima |
|---|---:|---:|
| Inscrições abertas e retificações | a cada 15 min | 2 h |
| Edital publicado | a cada 30 min | 4 h |
| Autorização, comissão e banca | a cada 6 h | 1 dia útil |
| Acervo histórico | semanal | 5 dias úteis |

O painel de operação deve alertar sobre fonte indisponível, mudança de formato, documento não processado, hash alterado, fila atrasada e registro sem nova conferência dentro do prazo.

## Limite que permanece

O código de sincronização não cria uma fonte nacional que o poder público ainda não oferece. Cobertura ampla depende de operar os conectores, credenciais do INLABS, armazenamento dos documentos e equipe de revisão. Essa limitação deve continuar pública: qualidade auditável vale mais do que um número inflado de concursos copiados de fontes secundárias.
