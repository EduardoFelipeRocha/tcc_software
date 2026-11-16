1. Metodologia


2. Planejamento (EAP, Roadmap, Estimativas)


3. Gestão de Riscos


5. Atas de Sprint

No GitHub: Crie uma pasta docs/gestao/ (ex.: PLANO_DE_PROJETO.md, MATRIZ_RISCOS.md, ATAS_SPRINT.md).


No TCC (PDF/Word): Coloque como um capítulo de Engenharia de Software / Metodologia ou como Apêndice, referenciando os links diretos do repositório.

4. Gestão de Configuração (Quadro, Branches, PRs, Commits)	
GitHub Projects: Crie um quadro Kanban/Scrumban público no próprio repositório (Projects -> New project) com as colunas Backlog, Sprint Atual, Em Revisão, Concluído e mova as tarefas principais para lá.


Git: Garanta que o histórico tenha commits semânticos (feat:, fix:, test:) e ao menos 2 ou 3 Pull Requests fechados/mergeados (mesmo trabalhando sozinho, abra PR da branch feat/... para main para comprovar o fluxo).

6. Desenvolvimento do MVP	É o próprio código-fonte nas pastas src/ e server/, apoiado pelo README.md na raiz explicando a arquitetura e como rodar (npm install e npm run dev).
7. CI/CD (Pipeline Automatizado)	Crie o arquivo .github/workflows/ci.yml no repositório. Assim que você der git push, a aba Actions do GitHub vai rodar automaticamente npm run lint, npm run test, npm run build e npm run test:e2e, gerando um selo verde (✓) visível para a banca.
8. Deploy + Link do Repositório	Suba o projeto gratuito no Render ou Railway (ambos suportam Node.js 24 + Express servindo o build estático do Vite na mesma porta). Coloque o link da aplicação no ar e o link do repositório no topo do README.md e na seção de Resultados do documento do TCC.