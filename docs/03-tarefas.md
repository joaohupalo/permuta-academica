# Etapa 3 — Tarefas

> Deriva de [`01-spec.md`](01-spec.md) e [`02-plano.md`](02-plano.md). Cada tarefa é pequena, gera **um commit** (`etapa 4: Txx ...`) e cita os critérios de aceitação que atende. A ordem segue o roteiro de demonstração: a cada tarefa concluída o sistema continua rodando.

## API

| # | Tarefa | Entrega | Atende |
|---|---|---|---|
| **T01** | Estrutura do projeto | Workspaces `api/` e `web/`, scripts `dev`, `db:reset`, `test`, TypeScript configurado | RNF-01 |
| **T02** | Banco de dados | `schema.ts` com as 10 tabelas, migração gerada, conexão e aplicação automática das migrações | Plano §4 |
| **T03** | Geração do calendário | Função que cria uma aula por turma/data/horário fixo, marca feriados, gera grupos de aulas compartilhadas | CA-01, CA-02 |
| **T04** | Autenticação | Login com bcrypt + JWT, `GET /auth/eu`, proteção por perfil | CA-20 |
| **T05** | Histórico e tempo real | Registro de eventos, `GET /historico`, SSE em `/api/eventos` com publicação após transações | RF-13, RF-18 |
| **T06** | Pedidos: criação | Candidatos, contrapartidas, criação com trava condicional, validações de choque, aula iniciada, feriado, cancelada, professor atual | CA-03, CA-04, CA-08, CA-09, CA-15 |
| **T07** | Pedidos: resposta | Aprovar (aplica troca, compartilhada vira vaga), recusar, cancelar, expirar; listagem recebidos/enviados | CA-05, CA-06, CA-07, CA-10, CA-14, CA-16 |
| **T08** | Reposição e cancelamento | `POST /reposicoes`, `GET /horarios-vagos`, `POST /aulas/:id/cancelar`; horário de aula cancelada aceita reposição | CA-11, CA-12, CA-13, CA-21 |
| **T09** | Saldo | Cálculo por disciplina e turma a partir das aulas, `GET /saldo` | Spec §7 |
| **T10** | Informativo | Texto padronizado por turma afetada, gravado no evento | CA-18 |
| **T11** | Painel da TV (API) | `GET /api/painel?data=` com a semana de SI e ADS | RF-16, RF-17 |
| **T12** | Cadastros e CSV (API) | CRUD de semestre, turmas, professores, disciplinas, feriados; `POST /importar/:tipo`; feriado novo marca aulas | RF-01, RF-02, RF-04, CA-19 |
| **T13** | Script de carga | Semestre 2026/2, 6 turmas, professores, disciplinas (uma compartilhada), feriados, histórico prévio de trocas | Spec §11 |

## Web

| # | Tarefa | Entrega | Atende |
|---|---|---|---|
| **T14** | Base do front | Vite + React + Tailwind, cliente HTTP com token, conexão SSE que invalida consultas, layout com menu, login, rota protegida | CA-20, RF-18 |
| **T15** | Minha grade | Semana com navegação; aulas do professor (ou todas, para a coordenação) com destaque de troca, trava, vaga, feriado e cancelada | RF-05 a RF-10 |
| **T16** | Solicitar | Abas compensatória, pontual e reposição; colegas disponíveis; resumo antes/depois; cancelamento com motivo | CA-03, CA-06, CA-08, CA-11, CA-13 |
| **T17** | Pedidos e informativo | Abas recebidos/enviados, aprovar/recusar/cancelar em um clique, contador no menu, informativo com Copiar e WhatsApp | CA-05, CA-07, CA-18, RF-19 |
| **T18** | Saldo e histórico | Indicadores, tabela por disciplina e turma com situação, linha do tempo | RF-12, RF-13 |
| **T19** | Cadastros | Telas da coordenação para todos os cadastros, geração do calendário, importação CSV com prévia | RF-01, RF-02, CA-19 |
| **T20** | Painel da TV | Grade semanal em tela cheia, alto contraste, destaques, relógio, rolagem automática, virada à meia-noite, `?data=` | CA-17, RNF-02, RNF-03 |
| **T21** | README | Como rodar, contas de teste, roteiro da demonstração | RNF-01, RNF-04 |
| **T23** | Identidade visual | Visual alinhado ao portal acadêmico da Unimater (JACAD): logo, paleta, fonte Roboto, menu lateral claro com ícones, barra superior com o usuário, cartões brancos; TV nas cores da instituição | RNF-03, RNF-04 |
| **T24** | Noite inteira e compensatória neutra | Grupo de aulas por noite (2 horários); choques em todos os horários; reposição e cancelamento por noite; cadastro de disciplina por noites; coluna `disciplina_responsavel_id` e saldo por responsável; massa refeita sem noites divididas | RN-11, CA-05, CA-06, CA-10, CA-11, CA-13, CA-21, CA-22 |

## Etapa 5 — Validação

| # | Tarefa | Entrega | Atende |
|---|---|---|---|
| **T22** | Testes dos critérios | Um teste por critério de aceitação da API, nomeado com o código CA-xx; teste de concorrência repetido 50 vezes | CA-01 a CA-16, CA-18 a CA-22 |

CA-17 (atualização da TV sem recarregar) é verificado na demonstração ao vivo, e a parte da API (evento SSE publicado após a aprovação) é coberta em T22.

## Rastreabilidade

| Critério | Tarefas | Teste |
|---|---|---|
| CA-01, CA-02 | T03 | `calendario.test.ts` |
| CA-03, CA-04, CA-08, CA-09, CA-15 | T06 | `pedidos-criacao.test.ts` |
| CA-05, CA-06, CA-07, CA-10, CA-16 | T07, T09 | `pedidos-resposta.test.ts` |
| CA-11, CA-12, CA-13, CA-21 | T08, T09 | `reposicao-cancelamento.test.ts` |
| CA-14 | T06, T07 | `concorrencia.test.ts` |
| CA-17 | T05, T11, T20 | `tempo-real.test.ts` + demonstração |
| CA-18 | T10, T17 | `informativo.test.ts` |
| CA-19 | T12, T19 | `cadastros.test.ts` |
| CA-20 | T04, T14 | `auth.test.ts` |
