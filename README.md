# GuiaConcursos

Aplicação full-stack desenvolvida como TCC para descobrir concursos públicos, consultar evidências oficiais e gerar planos de estudo explicáveis.

## O que já funciona

- Catálogo rastreável com filtros exatos por localização, escolaridade, situação, esfera e área;
- Busca natural com normalização de acentos, palavras funcionais e termos como “concursos federais”;
- API de catálogo com atualização periódica por feeds estruturados, cache seguro e painel de saúde;
- Concursos abertos, editais publicados e etapas pré-edital verificadas em fontes primárias;
- Salário, taxa, vagas, prazo, banca, data de verificação e link oficial por registro;
- Área de provas anteriores com cadernos e gabaritos oficiais disponíveis;
- Gerador de plano por objetivo, disponibilidade, dias e conhecimento por matéria;
- Tela do plano com matérias expansíveis, tópicos oficiais, edital-base, material da edição anterior, sessões semanais e progresso;
- Cadastro, login, logout e sessão por cookie HTTP-only;
- Senha derivada com scrypt e sal individual, sem armazenamento em texto;
- Biblioteca com múltiplos planos e progresso independente por usuário no servidor local;
- Bloqueio de plano genérico quando um card reúne cargos ou especialidades com programas diferentes;
- Migração defensiva de planos convidados criados na versão anterior;
- Interface responsiva e acessível por teclado.

## Cobertura dos dados

O catálogo embarcado é uma seleção real conferida em fontes oficiais. A API pode incorporar novos registros por feeds HTTPS sem exigir novo build, recalcula janelas de inscrição pela data oficial e mantém o último snapshot válido quando um conector falha. A interface mostra total publicado, UFs cobertas, última verificação e registros que precisam ser revistos.

Não existe um cadastro público único que reúna todos os concursos da União, estados, Distrito Federal, municípios, Poderes e órgãos autônomos. Por isso, o produto não afirma uma cobertura absoluta impossível de auditar. Um registro só entra depois da verificação da fonte. Sem edital, remuneração e taxa permanecem como “a confirmar”, em vez de reutilizar valores históricos como se fossem atuais. A operação contínua está documentada em `docs/ATUALIZACAO_CATALOGO.md`.

## Executar localmente

Requisitos: Node.js 24 ou versão compatível e npm.

```powershell
npm install
npm run dev
```

O comando inicia:

- interface Vite em `http://localhost:5173`;
- API Express em `http://127.0.0.1:3333`.

Contas e planos ficam em `server/data.json`, criado no primeiro cadastro e ignorado pelo Git. Use `server/data.example.json` apenas como referência de estrutura.

Para habilitar atualização externa do catálogo, copie `.env.example` para `.env` e configure `CATALOG_FEED_URLS`. O servidor consulta os feeds periodicamente; `GET /api/catalog/health` expõe a saúde da cobertura sem revelar credenciais ou URLs privadas.

## Verificação

```powershell
npm run lint
npm run test
npm run build
npm run test:e2e
```

O teste ponta a ponta usa banco temporário e cobre filtros, busca, prova e gabarito, matérias expansíveis, geração de dois planos, cadastro, gravação e retomada do progresso, biblioteca da conta, tema, perfil e migração segura de um plano legado. Testes unitários adicionais validam datas, busca natural, localização exata e rejeição de feeds sem evidência oficial.

## Estrutura

```text
server/         API, autenticação e persistência JSON do MVP
src/
  app/          shell e rotas
  data/         repositório e catálogo oficial curado
  entities/     contratos de domínio
  features/     autenticação e planejamento
  pages/        páginas da aplicação
  shared/       componentes compartilhados
  styles/       identidade visual responsiva
tests/e2e/      fluxo crítico no navegador
docs/           escopo e governança dos dados
```

## Limites antes de produção

O backend atual é adequado à demonstração acadêmica e ao desenvolvimento local. Uma publicação para usuários reais ainda exige banco transacional, HTTPS, recuperação e verificação de e-mail, proteção contra tentativas repetidas, política de privacidade/LGPD, backups, armazenamento imutável dos documentos e operação dos conectores/revisão editorial.
