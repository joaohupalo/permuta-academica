import { and, eq, inArray } from 'drizzle-orm'
import type { Tx } from '../../contexto.js'
import { aula, disciplina, disciplinaTurma, feriado, horarioFixo, pedido, semestre } from '../../db/schema.js'
import { datasEntre, diaDaSemana } from '../../compartilhado/horarios.js'
import { conflito, invalido } from '../../compartilhado/erros.js'

/** Grupo = a noite da disciplina naquela data: os dois horários, em todas as turmas dela (RN-11). */
export function chaveGrupo(data: string, disciplinaId: number) {
  return `g|${data}|d${disciplinaId}`
}

/**
 * Gera o calendário do semestre (RF-03, RF-04):
 * para cada data, cada horário fixo daquele dia da semana cria uma aula por turma da disciplina.
 * Aulas de uma mesma disciplina compartilhada no mesmo horário formam um grupo (CA-02).
 */
export function gerarCalendario(tx: Tx, opcoes: { substituir?: boolean } = {}) {
  const sem = tx.select().from(semestre).get()
  if (!sem) throw invalido('Cadastre o semestre antes de gerar o calendário.')
  if (sem.inicio > sem.fim) throw invalido('A data de início do semestre é posterior à data de fim.')

  const existentes = tx.select({ id: aula.id }).from(aula).limit(1).all()
  if (existentes.length && !opcoes.substituir) {
    throw conflito('O calendário já foi gerado. Confirme a substituição para gerar de novo (as trocas registradas serão apagadas).')
  }
  if (existentes.length) {
    tx.delete(pedido).run()
    tx.delete(aula).run()
  }

  const feriados = new Set(tx.select({ data: feriado.data }).from(feriado).all().map((f) => f.data))
  const disciplinas = tx.select().from(disciplina).all()
  const professorDe = new Map(disciplinas.map((d) => [d.id, d.professorId]))
  const horarios = tx.select().from(horarioFixo).all()
  const turmasDe = new Map<number, number[]>()
  if (disciplinas.length) {
    for (const dt of tx.select().from(disciplinaTurma).where(inArray(disciplinaTurma.disciplinaId, disciplinas.map((d) => d.id))).all()) {
      turmasDe.set(dt.disciplinaId, [...(turmasDe.get(dt.disciplinaId) ?? []), dt.turmaId])
    }
  }

  const ocupado = new Set<string>()
  const novas: (typeof aula.$inferInsert)[] = []
  const choques: string[] = []

  for (const data of datasEntre(sem.inicio, sem.fim)) {
    const dia = diaDaSemana(data)
    for (const h of horarios.filter((x) => x.diaSemana === dia)) {
      for (const turmaId of turmasDe.get(h.disciplinaId) ?? []) {
        const chave = `${turmaId}|${data}|${h.horario}`
        if (ocupado.has(chave)) {
          choques.push(chave)
          continue
        }
        ocupado.add(chave)
        novas.push({
          turmaId,
          data,
          horario: h.horario,
          sala: h.sala,
          grupo: chaveGrupo(data, h.disciplinaId),
          disciplinaPrevistaId: h.disciplinaId,
          disciplinaResponsavelId: h.disciplinaId,
          disciplinaAtualId: h.disciplinaId,
          professorAtualId: professorDe.get(h.disciplinaId)!,
          status: feriados.has(data) ? 'feriado' : 'normal',
        })
      }
    }
  }

  for (let i = 0; i < novas.length; i += 500) tx.insert(aula).values(novas.slice(i, i + 500)).run()
  return { aulas: novas.length, choques: choques.length }
}

/** Ao cadastrar um feriado depois da geração, as aulas daquela data viram feriado (RF-04). */
export function marcarFeriado(tx: Tx, data: string) {
  return tx
    .update(aula)
    .set({ status: 'feriado' })
    .where(and(eq(aula.data, data), eq(aula.status, 'normal')))
    .run().changes
}

/** Ao remover um feriado, as aulas daquela data voltam ao normal. */
export function desmarcarFeriado(tx: Tx, data: string) {
  return tx
    .update(aula)
    .set({ status: 'normal' })
    .where(and(eq(aula.data, data), eq(aula.status, 'feriado')))
    .run().changes
}
