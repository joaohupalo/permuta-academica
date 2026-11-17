import type { Tx } from '../../contexto.js'
import { aula, disciplina, turma, usuario } from '../../db/schema.js'
import { descreverHorario, diaDaSemana, formatarData, NOMES_DIAS } from '../../compartilhado/horarios.js'

type LinhaAula = typeof aula.$inferSelect

/** Nomes de turmas, disciplinas e professores, para montar textos legíveis. */
export function carregarNomes(tx: Tx) {
  const turmas = new Map(tx.select().from(turma).all().map((t) => [t.id, t.nome]))
  const disciplinas = new Map(tx.select().from(disciplina).all().map((d) => [d.id, d]))
  const pessoas = new Map(tx.select({ id: usuario.id, nome: usuario.nome }).from(usuario).all().map((u) => [u.id, u.nome]))
  return {
    turma: (id: number) => turmas.get(id) ?? '?',
    disciplina: (id: number | null) => (id ? (disciplinas.get(id)?.nome ?? '?') : null),
    professorDaDisciplina: (id: number | null) => (id ? (pessoas.get(disciplinas.get(id)?.professorId ?? -1) ?? '?') : null),
    pessoa: (id: number | null) => (id ? (pessoas.get(id) ?? '?') : null),
  }
}

type Nomes = ReturnType<typeof carregarNomes>

function descreverSituacao(a: LinhaAula, n: Nomes) {
  if (a.status === 'cancelada') return `Aula cancelada (${n.disciplina(a.disciplinaAtualId)})${a.motivo ? ` — motivo: ${a.motivo}` : ''}`
  if (a.status === 'vaga' || !a.disciplinaAtualId) return 'Sem aula neste horário'
  return `${n.disciplina(a.disciplinaAtualId)} — ${n.pessoa(a.professorAtualId)}`
}

/**
 * Informativo padronizado para os alunos (RF-15, CA-18): um texto por turma afetada,
 * pronto para copiar ou compartilhar no WhatsApp.
 */
export function gerarInformativo(tx: Tx, antes: LinhaAula[], depois: LinhaAula[]): string[] {
  const n = carregarNomes(tx)
  const anterior = new Map(antes.map((a) => [a.id, a]))
  const porTurma = new Map<number, string[]>()

  for (const a of [...depois].sort((x, y) => (x.data + x.horario).localeCompare(y.data + y.horario))) {
    const antigo = anterior.get(a.id)
    const previsto = antigo
      ? antigo.status === 'vaga' || !antigo.disciplinaAtualId
        ? 'Sem aula'
        : `${n.disciplina(antigo.disciplinaAtualId)} — ${n.pessoa(antigo.professorAtualId)}${antigo.status === 'cancelada' ? ' (cancelada)' : ''}`
      : 'Sem aula'
    const linhas = [
      `Data: ${NOMES_DIAS[diaDaSemana(a.data)]}, ${formatarData(a.data)} — ${descreverHorario(a.horario)}`,
      `Aula prevista: ${previsto}`,
      a.status === 'cancelada' || a.status === 'vaga' ? `Situação: ${descreverSituacao(a, n)}` : `Aula que será ministrada: ${descreverSituacao(a, n)}`,
    ]
    if (a.sala && a.status === 'normal') linhas.push(`Sala: ${a.sala}`)
    porTurma.set(a.turmaId, [...(porTurma.get(a.turmaId) ?? []), linhas.join('\n')])
  }

  return [...porTurma.entries()].map(
    ([turmaId, blocos]) => `*Alteração de aula — ${n.turma(turmaId)}*\n\n${blocos.join('\n\n')}\n\n_Informativo gerado pelo sistema Permuta Acadêmica._`,
  )
}
