# Escopo do GuiaConcursos

## Visão

O GuiaConcursos conecta duas necessidades hoje fragmentadas:

1. descobrir uma oportunidade compatível com o perfil do candidato;
2. transformar documentos oficiais e provas anteriores em uma rotina de estudo possível.

O Corpo de Bombeiros é um caso de uso, não o limite do produto. A arquitetura aceita concursos federais, estaduais e municipais de todas as regiões.

## Recorte defensável para o TCC

O produto tem alcance nacional, mas a integração oficial é progressiva. O catálogo acadêmico usa uma amostra multirregional, curada em fontes primárias e datada. Essa delimitação permite avaliar uma jornada completa sem alegar uma cobertura nacional impossível de comprovar manualmente.

Formulação pública adotada:

> Concursos monitorados em fontes oficiais de diferentes regiões do Brasil.

Não usar:

> Todos os concursos do Brasil.

Não existe um catálogo oficial único que cubra União, estados, Distrito Federal, municípios, Poderes e órgãos autônomos.

## Jornada principal

1. Usuário pesquisa cargo, órgão, localização ou área;
2. Sistema apresenta situação, vagas, remuneração, taxa e origem;
3. Usuário consulta edital, prova anterior e gabarito, quando disponíveis;
4. Informa disponibilidade e nível por matéria;
5. Sistema só libera o plano após validar cargo, documento-base, matérias e tópicos;
6. Usuário cria uma conta e vincula o plano;
7. Matérias podem ser abertas para consultar o conteúdo programático completo e o edital usado;
8. Cada sessão concluída é salva no servidor, separada dos demais objetivos;
9. A conta lista todos os planos e permite continuar qualquer um deles do ponto em que parou.

## Diferencial acadêmico

- descoberta nacional de oportunidades;
- rastreabilidade da informação;
- separação entre histórico, etapa atual e fato ainda não publicado;
- planejamento adaptativo explicável;
- continuidade do estudo por conta autenticada;
- transição futura do pré-edital para o edital vigente.

Pergunta de pesquisa sugerida:

> Uma plataforma pré-edital com planejamento adaptativo e rastreabilidade documental melhora a confiança, a organização e a adesão aos estudos de candidatos a concursos públicos?

Métricas possíveis:

- Escala de Usabilidade do Sistema (SUS);
- tempo para localizar uma oportunidade e criar um plano;
- taxa semanal de cumprimento;
- confiança percebida nas informações;
- compreensão da diferença entre previsão, autorização e edital;
- capacidade de retomar uma sessão após novo acesso.

## Limites do MVP

- Não promete aprovação;
- Não afirma data, taxa, banca, salário ou vagas sem documento;
- Não apresenta valores de edição anterior como atuais;
- Não decide elegibilidade com base somente no concurso anterior;
- Não prescreve treinamento físico ou orientação médica;
- Não apresenta portal privado como fonte oficial;
- Não cria plano único para um card que agrupa cargos com programas diferentes;
- Não chama um plano legado sem URL de “baseado em edital”; o histórico é preservado com alerta;
- Não afirma cobertura integral de todos os concursos brasileiros;
- Não oferece ainda recuperação de senha, verificação de e-mail ou sincronização em infraestrutura de produção.
