# Etapa 5 — Roteiro de testes manuais

> Complementa os testes automáticos (`npm test`). Cada fluxo cita os critérios de aceitação (CA-xx) da [`01-spec.md`](01-spec.md).
> Os fluxos foram pensados para rodar **em ordem**, sobre a massa da demonstração. Se algo sair do esperado no meio, rode `npm run db:reset`, reinicie o `npm run dev` e recomece.

## Preparação

1. `npm run db:reset` e `npm run dev`.
2. Abra **três janelas**: uma com a **TV** (`localhost:5173/tv?data=2026-11-25`) e duas **anônimas**, para logar dois professores ao mesmo tempo. Senha de todos: `123456`.
3. Durante todos os fluxos, **não aperte F5**: tudo deve atualizar sozinho (CA-17).

Referência rápida (turma SI 4º): seg = Ética (Hélio, junto com ADS 4º) · ter = Programação Web (Carla) · qua = Eng. de Software (Bruno) · qui = Banco de Dados II (Ana) · sex = **vaga**.

---

## F1 — Acesso (CA-20)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 1 | Sem login, abra `/tv` | Painel abre normalmente | ☐ |
| 2 | Sem login, abra `/pedidos` | Volta para a tela de login | ☐ |
| 3 | Login com senha errada | Mensagem "E-mail ou senha incorretos" | ☐ |
| 4 | Login como **Ana** | Menu sem "Cadastros" | ☐ |
| 5 | Login como **coordenacao@unimater.edu** | Menu com "Cadastros" | ☐ |

## F2 — Troca compensatória (CA-03, CA-04, CA-05, CA-17, CA-18)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 1 | **Ana** → Solicitar troca → Compensatória → noite **qui 26/11** | Colegas livres: Bruno e Hélio. Aviso de que 1 colega já tem aula (Carla) | ☐ |
| 2 | Escolha **Bruno** → noite **qua 25/11** | Resumo mostra as duas noites e "Impacto no saldo: nenhum (permuta)" | ☐ |
| 3 | Enviar | Vai para Pedidos/Enviados com status Pendente | ☐ |
| 4 | Ana → Minha grade → semana seguinte (→) | Quarta e quinta do SI 4º com 🔒 | ☐ |
| 5 | Na outra janela, **Carla** → Compensatória → **ter 24/11** → Bruno | A lista de noites do Bruno **não** mostra 25/11 (travada) | ☐ |
| 6 | Saia da Carla e entre como **Bruno** | Aviso "Novo pedido de troca de Ana Souza" e contador 1 em Pedidos | ☐ |
| 7 | Bruno → Pedidos → **Aprovar troca** | Abre o informativo do SI 4º com os 4 horários (2 noites) | ☐ |
| 8 | Clique **Compartilhar no WhatsApp** | Abre o WhatsApp com o texto pronto | ☐ |
| 9 | Olhe a TV (sem F5) | Quarta e quinta do SI 4º com **TROCA** nos dois horários e "no lugar de…" | ☐ |
| 10 | Ana → Saldo | Banco de Dados II (SI 4º): **0 cedidas, 0 assumidas, saldo 0** | ☐ |

## F3 — Recusar e cancelar pedido (CA-07)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 1 | **Ana** → Compensatória → **qui 03/12** ⇄ Bruno **qua 02/12** → Enviar | Pendente | ☐ |
| 2 | **Bruno** → Pedidos → **Recusar** | Status Recusado; na grade, sem 🔒 | ☐ |
| 3 | Ana faz o mesmo pedido de novo | Pendente | ☐ |
| 4 | Ana → Pedidos → Enviados → **Cancelar pedido** | Status Cancelado; histórico registra recusa e cancelamento | ☐ |

## F4 — Troca pontual e acerto de contas (CA-06, CA-24)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 1 | **Ana** → Pontual → **qui 03/12** → Bruno → Enviar | Resumo: "você −2 · Bruno +2" | ☐ |
| 2 | **Bruno** aprova | — | ☐ |
| 3 | Ana → Saldo | BD II: 2 cedidas, saldo **−2**, "2 a repor" | ☐ |
| 4 | Ana → Saldo → Acerto de contas | "Ana Souza deve **2 aulas a Bruno Lima**" + "Aguarde Bruno te ceder uma noite" (também aparece Carla devendo ao Hélio, que vem da massa) | ☐ |
| 5 | **Bruno** → Saldo → **Ceder uma noite a Ana** | Abre a troca pontual com aviso de acerto, só noites do SI 4º | ☐ |
| 6 | Escolha **qua 02/12** | Ana já vem selecionada, com Banco de Dados II | ☐ |
| 7 | Enviar → **Ana** aprova | Os dois com saldo **0**; a linha Ana→Bruno some do acerto | ☐ |

## F5 — Aula assumida e depois cancelada (CA-23)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 1 | **Ana** → Pontual → **qui 10/12** → Bruno → **Bruno** aprova | Ana −2, Bruno +2 | ☐ |
| 2 | **Bruno** → Minha grade → semana de 07/12 → card de **quinta** (Eng. de Software) → **Cancelar a noite** → motivo | Toast "Noite cancelada (2 aulas)" | ☐ |
| 3 | Bruno → Saldo | Eng. de Software: assumidas **não aumentam** (continuam as 2 do F4), **canceladas 0**, saldo **0** — a noite assumida e cancelada não conta | ☐ |
| 4 | Ana → Saldo | BD II: saldo **−2**; acerto: "Ana deve **2 aulas à turma**" + botão **Repor em noite vaga** | ☐ |

## F6 — Reposição pelo acerto (CA-11)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 1 | **Ana** → Saldo → **Repor em noite vaga** | Abre a aba Reposição com BD II e SI 4º preenchidos | ☐ |
| 2 | Escolha **sex 27/11** → Registrar | Informativo da reposição | ☐ |
| 3 | Ana → Saldo | BD II saldo **0**; acerto da Ana some | ☐ |
| 4 | TV com `?data=2026-11-27` | SI 4º sexta com **REPOSIÇÃO** nos dois horários | ☐ |

## F7 — Aula adiantada (CA-25)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 1 | **Bruno** → Reposição → Eng. de Software → **sex 04/12** → Registrar | Bruno saldo **+2** | ☐ |
| 2 | Bruno → Saldo → Acerto | "Bruno Lima tem **2 aulas adiantadas**: pode cancelar uma noite futura" | ☐ |
| 3 | Bruno → Minha grade → semana de 07/12 → **quarta 09/12** → Cancelar a noite → motivo "Aula adiantada em 04/12" | Bruno saldo **0**; acerto some | ☐ |

## F8 — Colega cobre noite cancelada (CA-13, CA-21)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 1 | **Ana** → Minha grade → semana de 30/11 → **terça 01/12** (Banco de Dados, ADS 4º) → Cancelar a noite → motivo | Banco de Dados (ADS 4º): 2 canceladas, saldo −2 | ☐ |
| 2 | Tente cancelar **sem motivo** | Mensagem pedindo o motivo | ☐ |
| 3 | **Gustavo** → Reposição → Gestão de Projetos | Lista mostra **ADS 4º · ter 01/12 · aula de Banco de Dados cancelada** | ☐ |
| 4 | Registrar | Informativo com "Banco de Dados — Ana Souza (cancelada)" | ☐ |
| 5 | TV com `?data=2026-12-01` | ADS 4º terça: **REPOSIÇÃO** de Gestão de Projetos "no lugar de Banco de Dados (cancelada)" | ☐ |
| 6 | Saldo → Acerto (filtro: todas) | "Ana deve 2 aulas a Gustavo" (ADS 4º) | ☐ |

## F9 — Noite compartilhada (CA-10)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 1 | **Hélio** → Pontual → **seg 30/11** (ADS 4º + SI 4º) → Bruno | Resumo mostra o alerta vermelho: "ADS 4º ficará sem aula…" | ☐ |
| 2 | Enviar → **Bruno** aprova | Informativo com **dois** textos (SI 4º e ADS 4º); o do ADS diz "Sem aula neste horário" | ☐ |
| 3 | TV com `?data=2026-11-30` | SI 4º segunda: **TROCA** (Eng. de Software); ADS 4º segunda: **SEM AULA** | ☐ |
| 4 | Hélio → Saldo | Ética (ADS 4º): 2 cedidas, saldo −2 | ☐ |

## F10 — Concorrência na tela (CA-14)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 1 | **Ana** → Pontual → **qui 19/11** → Bruno → Enviar | Pendente | ☐ |
| 2 | Abra **Bruno** em duas janelas, ambas em Pedidos | Mesmo pedido nas duas | ☐ |
| 3 | Clique **Aprovar** nas duas, o mais rápido possível | Uma aprova; a outra mostra "Este pedido já foi aprovado" (ou some sozinho) | ☐ |

## F11 — Coordenação (CA-19, CA-22)

| # | Passo | Esperado | ✓ |
|---|---|---|---|
| 1 | **Coordenação** → Cadastros → Feriados → Adicionar **08/12/2026** "Imaculada Conceição" | Na grade/TV daquela semana, terça aparece como Feriado | ☐ |
| 2 | Professores → **Importar CSV** → `docs/exemplos/professores.csv` | Prévia: **1 válida**, problemas nas linhas **3** (e-mail vazio) e **4** (já cadastrado) | ☐ |
| 3 | Confirmar importação | Paula Freitas aparece na lista | ☐ |
| 4 | Disciplinas → Adicionar → Fernanda Dias, turma SI 4º, noite **quinta** | Erro: a turma já tem Banco de Dados II na quinta à noite | ☐ |
| 5 | Troque para **sexta** e salve | Salva; o formulário só pede **noites** (não há como escolher um horário só) | ☐ |
| 6 | Semestre → **Gerar calendário** | Pede confirmação avisando que apaga as trocas (**cancele**) | ☐ |

---

Depois dos testes manuais, rode `npm test`: os 41 testes automáticos devem passar.
