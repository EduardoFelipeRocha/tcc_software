# Governança dos dados de concursos

## Princípio

Cada fato relevante deve possuir fonte, documento, versão, data de verificação e natureza da evidência. Uma fonte no rodapé da página não basta, pois uma retificação pode alterar somente um campo.

Naturezas iniciais:

- `official_current`;
- `official_historical`;
- `projection`;

Registros fictícios não são aceitos no catálogo público.

## Situações

O backend já recalcula abertura e encerramento da janela de inscrições pelas datas oficiais e pelo fuso de Brasília. A evolução para o modelo de eventos abaixo continua necessária para retificações, suspensão, prova e homologação; esses fatos não devem simplesmente sobrescrever o histórico.

| Situação | Evidência mínima |
|---|---|
| Previsto | Sinal institucional, planejamento ou previsão orçamentária; não equivale a autorização |
| Solicitado | Pedido formal publicamente verificável |
| Autorizado | Ato formal com número e data |
| Comissão formada | Portaria ou resolução de designação |
| Banca em seleção | Licitação, dispensa ou inexigibilidade iniciada |
| Banca selecionada | Resultado oficial da seleção |
| Banca contratada | Contrato ou extrato publicado |
| Edital publicado | Edital de abertura oficial, nunca minuta |
| Inscrições em breve | Edital publicado e janela futura |
| Inscrições abertas | Data atual dentro da janela vigente, considerando retificações |
| Inscrições encerradas | Janela encerrada, certame ainda pode continuar |
| Em andamento | Provas, recursos ou resultados em curso |
| Homologado | Resultado final homologado, com validade registrada |
| Suspenso/cancelado | Ato oficial sobrescritor |

Na interface, “ativo” deve ser substituído por grupos compreensíveis: inscrições abertas, editais publicados, em preparação, previstos e em andamento.

## Fontes iniciais

- [MGI — Autorizações e provimentos](https://www.gov.br/servidor/pt-br/observatorio-de-pessoal-govbr/autorizacoes-e-provimentos-concursos)
- [INLABS — Imprensa Nacional](https://inlabs.in.gov.br/acessar.php)
- [Dados abertos da Imprensa Nacional](https://www.gov.br/imprensanacional/pt-br/acesso-a-informacao/dados-abertos)
- [API pública do PNCP](https://pncp.gov.br/api/consulta/swagger-ui/index.html)
- [IOERJ — Diário Oficial do Estado do RJ](https://www.ioerj.com.br/portal/modules/conteudoonline/busca_do.php?acao=busca)
- [Diário Oficial do Município do Rio](https://doweb.rio.rj.gov.br/)
- [Portal de Concursos da Prefeitura do Rio](https://www.rio.rj.gov.br/web/portaldeconcursos/home)

O PNCP pode indicar seleção ou contratação de banca, mas não prova isoladamente que um edital está aberto.

## Sincronização implementada

A API aceita feeds estruturados de provedores configurados, atualiza-os periodicamente e publica metadados de saúde e cobertura. Um feed remoto precisa vincular cada concurso a uma fonte oficial HTTPS, data de coleta e hash SHA-256; projeções e evidências ausentes são rejeitadas. Cache condicional, assinatura HMAC opcional e estratégia de último snapshot válido protegem o catálogo de falhas externas.

Contrato, configuração e SLA recomendado: [Atualização contínua do catálogo](./ATUALIZACAO_CATALOGO.md).

## Modelo futuro

Entidades recomendadas:

- `organizations`;
- `competitions`;
- `competition_events`;
- `documents` e suas versões;
- `positions`;
- `vacancies` por natureza;
- `registration_windows`;
- `sources` e `connectors`;
- `field_evidence`;
- `previous_exams` e `answer_keys`;
- `study_plans` e instantâneo da entrada do algoritmo.

Regras:

- Separar vagas autorizadas, vagas imediatas e cadastro de reserva;
- Separar organizadora e banca examinadora;
- Manter retificações encadeadas, nunca apagar o edital anterior;
- Mostrar ano junto a taxa e remuneração histórica;
- Liberar inscrição somente para URL oficial validada;
- Encaminhar conflitos entre fontes para revisão humana;
- Guardar hash do documento para detectar alterações;
- Registrar a versão do algoritmo que gerou cada plano.
- Guardar no plano um instantâneo do edital-base, do material histórico de apoio e dos tópicos utilizados;
- Exigir seleção de cargo/área antes do plano quando um edital reúne programas distintos;
- Preservar planos antigos sem atribuir a eles uma proveniência oficial inexistente.
