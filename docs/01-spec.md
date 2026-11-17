# Etapa 1 — Spec: Sistema de Gestão e Permuta de Horários Acadêmicos (MVP)

> Fonte da verdade do projeto. O plano (`02-plano.md`), as tarefas (`03-tarefas.md`), o código e os testes derivam deste documento. Cada critério de aceitação tem um código **CA-xx**, citado nas tarefas e no nome dos testes.

## 1. Problema

Nos cursos de **Sistemas de Informação (SI)** e **Análise e Desenvolvimento de Sistemas (ADS)**, os professores trocam aulas entre si com frequência, por mensagens e acordos verbais. Isso gera três problemas:

1. **Perda de controle de aulas** — ninguém sabe quantas aulas cada disciplina já teve, cedeu ou precisa repor.
2. **Falha de comunicação** — alunos e professores chegam sem saber qual aula acontecerá.
3. **Cronograma inconsistente** — sem histórico, o fechamento do diário e o planejamento do semestre ficam difíceis.

## 2. Objetivo

Uma aplicação web que seja a **fonte única da verdade** da grade dos cursos noturnos de SI e ADS: registra trocas com aceite do colega, calcula o saldo de aulas automaticamente, mantém histórico auditável e exibe a programação da semana na TV do saguão, **atualizando todas as telas sem recarregar a página**.

## 3. Perfis

| Perfil | O que faz |
|---|---|
| **Coordenação (admin)** | Cadastra semestre, turmas, professores, disciplinas, horários fixos e feriados; gera o calendário. Vê tudo. |
| **Professor** | Vê sua grade, solicita e responde pedidos, faz reposições e cancelamentos das próprias aulas. Vê saldo e histórico de todos. |
| **Público (TV)** | Vê o painel da semana, sem login. |

Login por e-mail e senha. Na demonstração, contas `@unimater.edu` criadas pelo script de carga.

## 4. Conceitos

| Termo | Definição |
|---|---|
| **Semestre** | Período letivo com data de início e fim. Há um semestre ativo por vez. |
| **Turma** | Ex.: "SI 4º". Pertence a um curso (SI ou ADS). Todas no turno da noite. |
| **Horário** | Cada noite tem dois horários: **1º — 19:10 às 20:25** e **2º — 20:45 às 22:00**. |
| **Disciplina** | Tem nome, professor responsável, total de aulas previsto e uma ou mais turmas. Com mais de uma turma, é **compartilhada** (as turmas assistem juntas). |
| **Horário fixo** | Dia da semana + horário + sala em que a disciplina acontece. Uma disciplina pode ter vários. |
| **Aula** | Uma ocorrência concreta: **turma + data + horário**. Guarda a disciplina **prevista** (do calendário original) e a disciplina **atual** (o que vai acontecer). Unidade de contagem é **aula**, não hora. |
| **Grupo de aula** | As aulas de uma disciplina compartilhada no mesmo dia e horário (uma por turma). Operações sobre uma aula compartilhada atingem o grupo inteiro. |
| **Horário vago** | Turma + data + horário sem aula acontecendo: não existe aula ali, a aula ficou **vaga** por uma troca, ou a aula foi **cancelada**. |
| **Pedido** | Solicitação de troca de um professor a um colega. Status: pendente, aprovado, recusado, cancelado ou expirado. |

## 5. Requisitos funcionais

### Módulo 1 — Cadastro e calendário
- **RF-01** A coordenação cadastra, edita e remove: semestre, turmas, professores, disciplinas (com turmas e horários fixos) e feriados.
- **RF-02** Professores, turmas e feriados também podem ser importados por **CSV** (`nome,email` · `nome,curso` · `data,descricao`), com prévia antes de confirmar.
- **RF-03** O sistema gera o calendário do semestre: para cada data entre início e fim, para cada horário fixo daquele dia da semana, cria uma aula por turma da disciplina.
- **RF-04** Aulas que caem em feriado são criadas com status **feriado**. Cadastrar um feriado depois da geração marca as aulas daquela data como feriado.

### Módulo 2 — Trocas, reposições e cancelamentos
- **RF-05** **Troca compensatória**: o professor A oferece uma aula sua e pede uma aula do professor B, da mesma turma. Após o aceite de B, as duas aulas trocam de disciplina e professor.
- **RF-06** **Troca pontual**: o professor A cede uma aula sua ao professor B, que ministrará nela a disciplina dele. Exige aceite de B.
- **RF-07** Ao escolher a aula, o sistema lista **apenas os colegas disponíveis**: professores de qualquer turma daquela aula, livres naquela data e horário.
- **RF-08** O destinatário **aprova ou recusa com um clique**. O solicitante pode **cancelar** um pedido pendente.
- **RF-09** **Reposição em horário vago**: o professor ocupa um horário vago de uma turma da sua disciplina. Não exige aceite.
- **RF-10** **Cancelamento de aula**: o professor cancela uma aula sua informando o motivo por escrito.
- **RF-11** Não existe "desfazer": para voltar atrás, faz-se uma nova troca no sentido contrário. Aulas já trocadas podem ser trocadas de novo.

### Módulo 3 — Saldo e histórico
- **RF-12** Painel de saldo por **disciplina e turma**: previstas, ministradas, cedidas, assumidas, canceladas e saldo, calculados conforme a seção 7.
- **RF-13** Histórico cronológico de todos os eventos (pedido criado, aprovado, recusado, cancelado, expirado; reposição; cancelamento de aula; geração de calendário; cadastros). O histórico nunca é editado nem apagado.
- **RF-14** Lista de pedidos **recebidos** e **enviados**, com filtro por status. Todos os perfis veem saldo e histórico de todos.

### Módulo 4 — Divulgação
- **RF-15** Após uma troca aprovada, reposição ou cancelamento, o sistema gera um **informativo** padronizado por turma afetada (data, horário, turma, aula prevista, aula que será ministrada, professor), com botões **Copiar** e **Compartilhar no WhatsApp** (link `wa.me` com o texto pronto).
- **RF-16** **Painel da TV** (rota pública): grade da **semana corrente** de todas as turmas de SI e ADS — turma, horário, disciplina, professor e sala —, destacando aulas trocadas (com a disciplina originalmente prevista), reposições, aulas vagas, canceladas e feriados. Rola automaticamente se não couber, mostra relógio e vira de dia/semana sozinho à meia-noite. Aceita `?data=AAAA-MM-DD` para simular outra data.
- **RF-17** A API expõe os dados do painel em `GET /api/painel`, para que o sistema real da TV possa consumi-los.

### Transversal
- **RF-18** **Atualização em tempo real**: grade, pedidos, saldo, histórico e painel da TV se atualizam sozinhos, sem F5, quando algo muda.
- **RF-19** O professor é avisado dentro do sistema (contador e aviso na tela) quando recebe um pedido e quando um pedido seu é respondido.

## 6. Regras de negócio

- **RN-01** Trocas acontecem **somente entre professores da mesma turma**. Em aula compartilhada, vale qualquer professor de **qualquer** das turmas do grupo.
- **RN-02** Em aula compartilhada, **só as turmas atendidas pela disciplina do substituto recebem a aula**; as demais ficam **vagas** naquele horário.
- **RN-03** **Choque de horário**: um professor não pode ter duas aulas acontecendo na mesma data e horário. As aulas de um mesmo grupo contam como uma.
- **RN-04** Enquanto um pedido estiver **pendente**, **apenas as aulas envolvidas** ficam travadas: nenhum outro pedido, reposição ou cancelamento pode usá-las.
- **RN-05** Só podem ser trocadas, canceladas ou usadas em reposição aulas que **ainda não começaram**. **Não há antecedência mínima**: vale trocar no mesmo dia.
- **RN-06** Aulas em **feriado** não podem ser trocadas nem usadas em reposição. Aulas **canceladas** não podem ser trocadas, mas o horário que deixam fica **vago** e pode receber reposição de qualquer professor da turma; a aula cancelada continua registrada (e continua contando como débito de quem cancelou).
- **RN-07** Um pedido pendente **expira** automaticamente quando alguma de suas aulas começa; as travas são liberadas.
- **RN-08** Somente o professor **atual** de uma aula pode oferecê-la, cedê-la ou cancelá-la.
- **RN-09** Aprovação e criação de pedidos são **atômicas**: duas operações simultâneas sobre a mesma aula nunca são efetivadas ambas.
- **RN-10** Na reposição, o horário precisa estar vago **na turma escolhida**, e o professor livre naquele horário. Se a aula vaga tinha uma disciplina prevista, ela continua registrada como prevista.

## 7. Cálculo do saldo (por disciplina **d** e turma **t**)

Considerando apenas as aulas da turma **t**:

| Indicador | Regra |
|---|---|
| **Previstas** | aulas com prevista = d |
| **Ministradas** | aulas com atual = d, status normal, **já encerradas**; mais as aulas com prevista = d em **feriado** já passado |
| **Cedidas** | aulas com prevista = d e atual ≠ d (outra disciplina ou vaga) |
| **Assumidas** | aulas com atual = d e prevista ≠ d (outra disciplina ou nenhuma) |
| **Canceladas** | aulas com atual = d e status cancelada |
| **Saldo** | assumidas − cedidas − canceladas |

Situação: saldo < 0 → **a repor**; saldo = 0 → **em dia**; saldo > 0 → **crédito**.

O saldo é **sempre calculado a partir das aulas**; não existe valor guardado a ser "recalculado".

## 8. Requisitos não funcionais

- **RNF-01** Roda localmente com `npm install` e `npm run dev`; banco SQLite em arquivo, sem instalar servidor de banco.
- **RNF-02** Uma troca aprovada aparece no painel da TV em **até 5 segundos**, sem recarregar a página.
- **RNF-03** Painel da TV legível a distância: alto contraste, fonte grande, tela cheia.
- **RNF-04** Arquitetura e estrutura de pastas compreensíveis por quem abre o repositório pela primeira vez.

## 9. Critérios de aceitação

| Código | Dado / Quando | Então |
|---|---|---|
| **CA-01** | Semestre, horários fixos e feriados cadastrados / gera-se o calendário | Uma aula por turma, data e horário fixo, entre início e fim; aulas em feriados com status feriado. |
| **CA-02** | Disciplina compartilhada entre duas turmas / gera-se o calendário | Cada ocorrência gera uma aula por turma, formando um grupo. |
| **CA-03** | Professor A pede troca compensatória com B na mesma turma | Pedido pendente; as aulas dos dois ficam travadas. |
| **CA-04** | Aula travada por pedido pendente / outro pedido tenta usá-la | Recusado com mensagem de conflito. |
| **CA-05** | B aprova a compensatória | As duas aulas trocam disciplina e professor; travas liberadas; histórico registra; saldo das duas disciplinas fica **0** (1 cedida, 1 assumida). |
| **CA-06** | A cede aula a B (pontual) e B aprova | A disciplina de A fica com 1 cedida (saldo −1); a de B com 1 assumida (saldo +1). |
| **CA-07** | B recusa, ou A cancela o pedido | Nada muda nas aulas; travas liberadas; histórico registra. |
| **CA-08** | Professor sem aula livre / lista de colegas disponíveis | Só aparecem professores das turmas da aula e sem outra aula naquele horário. |
| **CA-09** | Troca colocaria um professor em duas aulas no mesmo horário | Operação recusada por choque de horário. |
| **CA-10** | Aula compartilhada (SI e ADS) passa a professor que só leciona em SI | SI recebe a aula do substituto; ADS fica vaga; a disciplina original conta 1 cedida em ADS. |
| **CA-11** | Professor faz reposição em horário vago | Aula criada (ou vaga preenchida); disciplina conta 1 assumida; sem aprovação. |
| **CA-12** | Reposição em horário ocupado, em feriado ou com o professor em choque | Recusada. |
| **CA-21** | Professor X cancela uma aula e o professor Y faz reposição nesse horário | X continua com 1 cancelada; Y fica com 1 assumida; a TV mostra a reposição de Y no lugar da aula cancelada. |
| **CA-13** | Professor cancela aula com motivo | Status cancelada; motivo registrado; disciplina conta 1 cancelada (saldo −1). Sem motivo, recusado. |
| **CA-14** | Duas operações simultâneas sobre a mesma aula (dois pedidos, ou duas aprovações do mesmo pedido) | Exatamente uma é efetivada; nenhuma inconsistência em **50 repetições**. |
| **CA-15** | Tentativa de trocar ou cancelar aula já iniciada | Recusada. |
| **CA-16** | Pedido pendente cuja aula já começou | Passa a expirado; travas liberadas. |
| **CA-17** | Troca aprovada | Painel da TV mostra a nova aula destacada, com a disciplina prevista, sem recarregar a página. |
| **CA-18** | Troca aprovada | Informativo gerado por turma afetada, com data, horário, turma, aula prevista, aula ministrada e professor; botões Copiar e WhatsApp funcionam. |
| **CA-19** | Importação de CSV de professores, turmas ou feriados | Prévia exibida; após confirmar, registros criados; linhas inválidas apontadas. |
| **CA-20** | Usuário sem login acessa área autenticada | Redirecionado ao login; a TV continua pública. |

## 10. Fora de escopo nesta versão

- Integração direta com o LXP (substituída pelo informativo + compartilhamento no WhatsApp).
- Envio automático por API do WhatsApp, e-mail ou push.
- Login institucional real (SSO).
- Integração com sistemas da secretaria e alocação automática de salas.
- Botão "desfazer" troca (substituído por nova troca no sentido contrário).
- Outros turnos e cursos além de SI e ADS noturnos.
- Aplicativo móvel e implantação em servidor.

## 11. Roteiro de demonstração

Massa de dados: semestre 2026/2 (03/08 a 12/12/2026), 6 turmas (SI 2º, 4º, 6º, 8º; ADS 2º, 4º), dois horários por noite, feriados nacionais do período (inclui 20/11) e uma disciplina compartilhada entre SI 4º e ADS 4º. Trocas, reposições e cancelamentos anteriores já registrados, para o saldo e o histórico não começarem vazios.

1. Abrir o painel da TV em uma tela e o sistema em outra. *(CA-01, CA-17)*
2. Ana Souza (Banco de Dados, SI 4º) pede troca compensatória da sua aula de quinta com a de quarta do Bruno Lima (Engenharia de Software). Aulas ficam travadas. *(CA-03)*
3. Outro professor tenta usar a aula travada e é bloqueado. *(CA-04)*
4. Bruno recebe o aviso sem recarregar e aprova. A TV atualiza sozinha, com destaque; saldo das duas disciplinas em zero. *(CA-05, CA-17)*
5. Compartilhar o informativo no WhatsApp. *(CA-18)*
6. Ana cede uma aula ao Bruno (pontual): Ana −1, Bruno +1. *(CA-06)*
7. Ana repõe a aula em um horário vago da turma e volta a zero. *(CA-11)*
8. Mostrar a aula compartilhada SI 4º/ADS 4º trocada: ADS fica vaga. *(CA-10)*
9. Rodar os testes automatizados, incluindo a concorrência repetida 50 vezes. *(CA-14)*

## 12. Decisões registradas

| Decisão | Motivo |
|---|---|
| Sem integração com LXP; informativo + botão WhatsApp | Inviável no prazo; o botão demonstra a ideia sem API paga ou não oficial. |
| SQLite local | Demonstração local, sem instalar servidor de banco. |
| Saldo calculado, nunca armazenado | Elimina a classe de erro "esqueci de recalcular". |
| Uma aula por turma (não por disciplina) | Permite que só uma turma de uma disciplina compartilhada receba a aula substituta. |
| Aula em feriado conta como ministrada; cancelada vira débito | Regra da coordenação. |
| Sem antecedência mínima | Prática real: trocas no mesmo dia. |
| Sem aprovação da coordenação | Trocas ficam entre os professores. |
| Horário de aula cancelada pode receber reposição | Prática real: o horário fica livre para outro professor da turma. |
