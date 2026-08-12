# Rumo — plataforma nacional de concursos

Protótipo funcional de TCC para descoberta de concursos públicos e geração de planos de estudo explicáveis.

O produto foi concebido para atender todas as regiões do Brasil com cobertura oficial progressiva. O primeiro recorte de integração será:

1. Executivo federal;
2. Estado do Rio de Janeiro;
3. Município do Rio de Janeiro.

> **Importante:** os concursos exibidos neste primeiro protótipo são cenários demonstrativos. Eles não representam inscrições, prazos ou situações atuais.

## O que já funciona

- Página inicial responsiva;
- Busca por cargo, órgão, área ou localização;
- Catálogo com filtros na URL;
- Estados distintos: inscrições abertas, edital, banca, comissão, autorizado e previsto;
- Página de detalhes com aviso de proveniência;
- Gerador determinístico de plano de estudos;
- Ajuste por horas disponíveis, dias e conhecimento por matéria;
- Plano semanal persistido no `localStorage`;
- Registro de sessões concluídas;
- Página pública de cobertura e metodologia;
- Navegação móvel e suporte a redução de animações.

## Executar localmente

Requisitos: Node.js 24 ou versão compatível e npm.

```powershell
npm install
npm run dev
```

O Vite mostrará o endereço local no terminal.

## Verificação

```powershell
npm run lint
npm run test
npm run build
```

## Estrutura

```text
src/
  app/          shell e rotas
  data/         repositório e cenários demonstrativos
  entities/     contratos de domínio
  features/     regras do planejamento
  pages/        páginas da aplicação
  shared/       componentes compartilhados
  styles/       identidade visual responsiva
docs/           decisões de produto e governança dos dados
```

As páginas consultam um `ContestRepository` assíncrono. Isso permite substituir os dados locais por API e banco sem reescrever a experiência.

## Próximos marcos

- Banco PostgreSQL e painel administrativo;
- Entidades de documentos, eventos e evidências por campo;
- Primeiro conector oficial federal;
- Curadoria dos concursos do RJ;
- Provas e gabaritos com verificação de permissão de uso;
- Autenticação, sincronização e adequação à LGPD;
- Comparador entre edição histórica e novo edital;
- Testes de interface e avaliação de usabilidade do TCC.

O nome **Rumo** é provisório e pode ser substituído sem alterar a arquitetura.
