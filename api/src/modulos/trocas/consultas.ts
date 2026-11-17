import { and, eq, inArray } from 'drizzle-orm'
import type { Tx } from '../../contexto.js'
import { aula, disciplina, disciplinaTurma, type ResumoAula } from '../../db/schema.js'
import { inicioDaAula } from '../../compartilhado/horarios.js'
import { conflito, naoEncontrado } from '../../compartilhado/erros.js'
import { carregarNomes } from '../informativo/gerar.js'

export type Aula = typeof aula.$inferSelect

export function buscarAula(tx: Tx, id: number): Aula {
  const a = tx.select().from(aula).where(eq(aula.id, id)).get()
  if (!a) throw naoEncontrado('Aula não encontrada.')
  return a
}

export function buscarDisciplina(tx: Tx, id: number) {
  const d = tx.select().from(disciplina).where(eq(disciplina.id, id)).get()
  if (!d) throw naoEncontrado('Disciplina não encontrada.')
  return d
}

export function aulasDoGrupo(tx: Tx, grupo: string): Aula[] {
  return tx.select().from(aula).where(eq(aula.grupo, grupo)).all()
}

export function turmasDaDisciplina(tx: Tx, disciplinaId: number): Set<number> {
  return new Set(
    tx.select({ t: disciplinaTurma.turmaId }).from(disciplinaTurma).where(eq(disciplinaTurma.disciplinaId, disciplinaId)).all().map((x) => x.t),
  )
}

/** RN-03: o professor já tem aula acontecendo nesse horário? Aulas do mesmo grupo contam como uma. */
export function professorOcupado(tx: Tx, professorId: number, data: string, horario: number, ignorarGrupos: string[] = []) {
  return tx
    .select({ grupo: aula.grupo })
    .from(aula)
    .where(and(eq(aula.professorAtualId, professorId), eq(aula.data, data), eq(aula.horario, horario), eq(aula.status, 'normal')))
    .all()
    .some((l) => !ignorarGrupos.includes(l.grupo))
}

/** RN-04, RN-05, RN-06: a aula pode entrar numa operação? */
export function exigirUtilizavel(a: Aula, agora: Date) {
  if (a.status === 'feriado') throw conflito('Aulas em feriado não podem ser alteradas.')
  if (a.status === 'cancelada') throw conflito('Esta aula foi cancelada e não pode ser alterada.')
  if (a.status === 'vaga') throw conflito('Este horário está vago; use a reposição.')
  if (inicioDaAula(a.data, a.horario) <= agora) throw conflito('Esta aula já começou ou já aconteceu.')
  if (a.pedidoPendenteId) throw conflito('Esta aula está travada por um pedido pendente. Aguarde a resposta ou cancele o pedido.')
}

export type TipoAula = 'normal' | 'troca' | 'reposicao' | 'vaga' | 'cancelada' | 'feriado'

/** Como a aula deve aparecer nas telas: igual ao previsto, trocada, reposição, vaga, cancelada ou feriado. */
export function classificar(a: Pick<Aula, 'status' | 'disciplinaPrevistaId' | 'disciplinaAtualId'>): TipoAula {
  if (a.status !== 'normal') return a.status
  if (!a.disciplinaPrevistaId) return 'reposicao'
  if (a.disciplinaAtualId !== a.disciplinaPrevistaId) return 'troca'
  return 'normal'
}

/** Descrição de um grupo de aulas, guardada no pedido. */
export function resumirGrupo(tx: Tx, linhas: Aula[]): ResumoAula {
  const n = carregarNomes(tx)
  const a = linhas[0]
  return {
    aulaId: a.id,
    turmas: linhas.map((l) => n.turma(l.turmaId)),
    data: a.data,
    horario: a.horario,
    disciplina: n.disciplina(a.disciplinaAtualId) ?? '—',
    professor: n.pessoa(a.professorAtualId) ?? '—',
  }
}

export function aulasPorIds(tx: Tx, ids: number[]): Aula[] {
  return ids.length ? tx.select().from(aula).where(inArray(aula.id, ids)).all() : []
}
