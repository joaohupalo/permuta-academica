/**
 * Script de carga da demonstração (T13): apaga o banco e cria um semestre completo de SI e ADS,
 * com histórico de trocas já registrado. Uso: npm run db:reset
 */
import { existsSync, rmSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { abrirBanco, type Banco } from './db/conexao.js'
import { aula, disciplina, disciplinaTurma, feriado, horarioFixo, semestre, turma, usuario } from './db/schema.js'
import type { Contexto } from './contexto.js'
import { Hub } from './modulos/eventos/hub.js'
import { gerarCalendario } from './modulos/calendario/gerar.js'
import { registrar } from './modulos/historico/registrar.js'
import { cancelarAula, criarPedido, reporAula, responderPedido } from './modulos/trocas/servico.js'
import { datasEntre, diaDaSemana } from './compartilhado/horarios.js'

const SEMESTRE = { nome: '2026/2', inicio: '2026-08-03', fim: '2026-12-12' }
const SENHA = '123456'

const FERIADOS = [
  ['2026-09-07', 'Independência do Brasil'],
  ['2026-10-12', 'Nossa Senhora Aparecida'],
  ['2026-11-02', 'Finados'],
  ['2026-11-15', 'Proclamação da República'],
  ['2026-11-20', 'Dia da Consciência Negra'],
] as const

const TURMAS = [
  ['SI 2º', 'SI'],
  ['SI 4º', 'SI'],
  ['SI 6º', 'SI'],
  ['SI 8º', 'SI'],
  ['ADS 2º', 'ADS'],
  ['ADS 4º', 'ADS'],
] as const

const PROFESSORES = [
  'Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Eduardo Alves', 'Fernanda Dias', 'Gustavo Reis', 'Hélio Martins',
  'Isabela Costa', 'Juliana Rocha', 'Leonardo Pires', 'Mariana Teixeira', 'Rafael Nunes', 'Sérgio Campos', 'Tatiane Moura',
]

// [disciplina, professor, turmas, noites (1 = segunda ... 5 = sexta), sala]
// Cada noite tem os dois horários (19:10–20:25 e 20:45–22:00) com o mesmo professor (RN-11).
const GRADE: [string, string, string[], number[], string][] = [
  // SI 4º — turma do roteiro de demonstração (sexta vaga, para reposição)
  ['Ética e Legislação em TI', 'Hélio Martins', ['SI 4º', 'ADS 4º'], [1], 'Auditório'],
  ['Programação Web', 'Carla Mendes', ['SI 4º'], [2], 'Lab 1'],
  ['Engenharia de Software', 'Bruno Lima', ['SI 4º'], [3], 'Sala 204'],
  ['Banco de Dados II', 'Ana Souza', ['SI 4º'], [4], 'Lab 3'],
  // ADS 4º (segunda compartilhada com o SI 4º)
  ['Banco de Dados', 'Ana Souza', ['ADS 4º'], [2], 'Lab 3'],
  ['Gestão de Projetos', 'Gustavo Reis', ['ADS 4º'], [3], 'Sala 105'],
  ['Interface Humano-Computador', 'Isabela Costa', ['ADS 4º'], [4], 'Sala 106'],
  ['Programação Mobile', 'Hélio Martins', ['ADS 4º'], [5], 'Lab 4'],
  // SI 2º
  ['Algoritmos e Programação', 'Eduardo Alves', ['SI 2º'], [1, 3], 'Lab 1'],
  ['Fundamentos de Sistemas de Informação', 'Juliana Rocha', ['SI 2º'], [2], 'Sala 201'],
  ['Matemática Discreta', 'Leonardo Pires', ['SI 2º'], [4], 'Sala 201'],
  ['Inglês Técnico', 'Mariana Teixeira', ['SI 2º'], [5], 'Sala 202'],
  // SI 6º (sexta vaga)
  ['Sistemas Distribuídos', 'Rafael Nunes', ['SI 6º'], [1], 'Lab 5'],
  ['Inteligência Artificial', 'Isabela Costa', ['SI 6º'], [2], 'Lab 5'],
  ['Segurança da Informação', 'Sérgio Campos', ['SI 6º'], [3], 'Lab 2'],
  ['Empreendedorismo', 'Tatiane Moura', ['SI 6º'], [4], 'Sala 203'],
  // SI 8º
  ['Trabalho de Conclusão de Curso II', 'Juliana Rocha', ['SI 8º'], [1], 'Sala 205'],
  ['Computação em Nuvem', 'Rafael Nunes', ['SI 8º'], [2], 'Lab 6'],
  ['Auditoria de Sistemas', 'Leonardo Pires', ['SI 8º'], [3], 'Sala 205'],
  ['Tópicos Avançados em Computação', 'Sérgio Campos', ['SI 8º'], [4], 'Lab 6'],
  ['Direito e Legislação Digital', 'Tatiane Moura', ['SI 8º'], [5], 'Sala 205'],
  // ADS 2º
  ['Comunicação e Expressão', 'Mariana Teixeira', ['ADS 2º'], [1], 'Sala 102'],
  ['Lógica de Programação', 'Eduardo Alves', ['ADS 2º'], [2], 'Lab 1'],
  ['Arquitetura de Computadores', 'Fernanda Dias', ['ADS 2º'], [3], 'Lab 2'],
  ['Sistemas Operacionais', 'Carla Mendes', ['ADS 2º'], [4], 'Lab 1'],
  ['Matemática Aplicada', 'Leonardo Pires', ['ADS 2º'], [5], 'Sala 102'],
]

export const emailDe = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '.') + '@unimater.edu'

/** Cadastra semestre, turmas, professores, disciplinas e feriados e gera o calendário. */
export function cadastrarBase(db: Banco, opcoes: { semestre?: typeof SEMESTRE } = {}) {
  const sem = opcoes.semestre ?? SEMESTRE
  const hash = bcrypt.hashSync(SENHA, 8)
  db.insert(usuario).values({ nome: 'Coordenação SI/ADS', email: 'coordenacao@unimater.edu', senhaHash: hash, papel: 'admin' }).run()
  const pessoas = new Map<string, number>()
  for (const nome of PROFESSORES) {
    pessoas.set(nome, db.insert(usuario).values({ nome, email: emailDe(nome), senhaHash: hash, papel: 'professor' }).returning().get().id)
  }
  const turmas = new Map<string, number>()
  for (const [nome, curso] of TURMAS) turmas.set(nome, db.insert(turma).values({ nome, curso }).returning().get().id)
  db.insert(semestre).values(sem).run()
  for (const [data, descricao] of FERIADOS) db.insert(feriado).values({ data, descricao }).run()

  const disciplinas = new Map<string, number>()
  for (const [nome, prof, ts, noites, sala] of GRADE) {
    const horarios = noites.flatMap((dia) => [[dia, 1], [dia, 2]] as [number, number][])
    let total = 0
    for (const data of datasEntre(sem.inicio, sem.fim)) total += horarios.filter(([dia]) => dia === diaDaSemana(data)).length
    const id = db.insert(disciplina).values({ nome, professorId: pessoas.get(prof)!, totalAulas: total }).returning().get().id
    disciplinas.set(`${nome}`, id)
    db.insert(disciplinaTurma).values(ts.map((t) => ({ disciplinaId: id, turmaId: turmas.get(t)! }))).run()
    db.insert(horarioFixo).values(horarios.map(([diaSemana, horario]) => ({ disciplinaId: id, diaSemana, horario, sala }))).run()
  }
  const r = gerarCalendario(db)
  return { pessoas, turmas, disciplinas, aulas: r.aulas }
}

/** Busca a aula de uma turma numa data e horário (usado para montar o histórico). */
export function aulaDe(db: Banco, turmaId: number, data: string, horario: number) {
  const a = db.select().from(aula).where(and(eq(aula.turmaId, turmaId), eq(aula.data, data), eq(aula.horario, horario))).get()
  if (!a) throw new Error(`Aula não encontrada: turma ${turmaId} ${data} ${horario}`)
  return a
}

/** Histórico prévio: operações feitas "no passado", pelo mesmo código que o sistema usa. */
function registrarHistorico(db: Banco, base: ReturnType<typeof cadastrarBase>) {
  const relogio = { atual: new Date() }
  const ctx: Contexto = { db, agora: () => relogio.atual, hub: new Hub() }
  const em = (iso: string) => (relogio.atual = new Date(iso))
  const p = (nome: string) => ({ id: base.pessoas.get(nome)!, nome })
  const t = (nome: string) => base.turmas.get(nome)!
  const d = (nome: string) => base.disciplinas.get(nome)!

  em('2026-08-01T09:00:00')
  registrar(db, relogio.atual, { usuarioId: 1, tipo: 'calendario_gerado', descricao: `Calendário do semestre ${SEMESTRE.nome} gerado: ${base.aulas} aulas` })

  // Pontual: Rafael cede uma noite de Sistemas Distribuídos a Isabela (IA) — Rafael −2, Isabela +2
  em('2026-09-14T10:00:00')
  const p1 = criarPedido(ctx, p('Rafael Nunes'), {
    tipo: 'pontual',
    aulaId: aulaDe(db, t('SI 6º'), '2026-09-21', 1).id,
    destinatarioId: p('Isabela Costa').id,
    disciplinaDestinoId: d('Inteligência Artificial'),
  })
  em('2026-09-14T15:30:00')
  responderPedido(ctx, p('Isabela Costa'), p1.id, 'aprovar')

  // Cancelamento e reposição: Sérgio cancela uma noite e repõe na sexta vaga do SI 6º — volta a zero
  em('2026-10-01T08:00:00')
  cancelarAula(ctx, p('Sérgio Campos'), aulaDe(db, t('SI 6º'), '2026-10-07', 1).id, 'Participação em banca de mestrado')
  em('2026-10-05T11:00:00')
  reporAula(ctx, p('Sérgio Campos'), { disciplinaId: d('Segurança da Informação'), turmaId: t('SI 6º'), data: '2026-10-16', sala: 'Lab 2' })

  // Compensatória: Juliana (terça) ⇄ Leonardo (quinta) no SI 2º — ninguém fica com cedida/assumida
  em('2026-10-20T14:00:00')
  const p2 = criarPedido(ctx, p('Juliana Rocha'), {
    tipo: 'compensatoria',
    aulaId: aulaDe(db, t('SI 2º'), '2026-10-27', 1).id,
    destinatarioId: p('Leonardo Pires').id,
    aulaPedidaId: aulaDe(db, t('SI 2º'), '2026-10-29', 1).id,
  })
  em('2026-10-21T09:10:00')
  responderPedido(ctx, p('Leonardo Pires'), p2.id, 'aprovar')

  // Pedido recusado
  em('2026-10-26T18:00:00')
  const p3 = criarPedido(ctx, p('Carla Mendes'), {
    tipo: 'compensatoria',
    aulaId: aulaDe(db, t('SI 4º'), '2026-11-10', 1).id,
    destinatarioId: p('Bruno Lima').id,
    aulaPedidaId: aulaDe(db, t('SI 4º'), '2026-11-11', 1).id,
  })
  em('2026-10-27T08:20:00')
  responderPedido(ctx, p('Bruno Lima'), p3.id, 'recusar')

  // Pontual: Carla cede uma noite a Hélio (Ética) — Carla fica devendo 2
  em('2026-11-09T09:00:00')
  const p4 = criarPedido(ctx, p('Carla Mendes'), {
    tipo: 'pontual',
    aulaId: aulaDe(db, t('SI 4º'), '2026-11-10', 1).id,
    destinatarioId: p('Hélio Martins').id,
    disciplinaDestinoId: d('Ética e Legislação em TI'),
  })
  em('2026-11-09T12:45:00')
  responderPedido(ctx, p('Hélio Martins'), p4.id, 'aprovar')

  // Pedido pendente, aguardando resposta de Mariana
  em('2026-11-16T20:30:00')
  criarPedido(ctx, p('Eduardo Alves'), {
    tipo: 'pontual',
    aulaId: aulaDe(db, t('SI 2º'), '2026-11-25', 1).id,
    destinatarioId: p('Mariana Teixeira').id,
    disciplinaDestinoId: d('Inglês Técnico'),
  })
}

// Executado direto (npm run db:reset)
if (process.argv[1]?.endsWith('carga.ts') || process.argv[1]?.endsWith('carga.js')) {
  const arquivo = process.env.BANCO ?? 'dados.db'
  for (const sufixo of ['', '-wal', '-shm']) if (existsSync(arquivo + sufixo)) rmSync(arquivo + sufixo)
  const db = abrirBanco(arquivo)
  const base = cadastrarBase(db)
  registrarHistorico(db, base)
  console.log(`
  Banco criado: ${arquivo}
  ${TURMAS.length} turmas · ${PROFESSORES.length} professores · ${GRADE.length} disciplinas · ${base.aulas} aulas

  Contas (senha de todas: ${SENHA})
    coordenacao@unimater.edu   (coordenação)
    ana.souza@unimater.edu     bruno.lima@unimater.edu     ...
`)
}
