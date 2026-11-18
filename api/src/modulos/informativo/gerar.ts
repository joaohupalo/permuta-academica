import type { Tx } from '../../contexto.js'
import { aula, disciplina, turma, usuario } from '../../db/schema.js'
import { descreverHorario, diaDaSemana, formatarData, HORARIOS, NOMES_DIAS } from '../../compartilhado/horarios.js'

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
 * com **um bloco por noite** (19:10–22:00), já que toda operação é da noite inteira (RN-11).
 * Pronto para copiar ou compartilhar no WhatsApp.
 */
export function gerarInformativo(tx: Tx, antes: LinhaAula[], depois: LinhaAula[]): string[] {
  const n = carregarNomes(tx)
  const anterior = new Map(antes.map((a) => [a.id, a]))
  const porTurma = new Map<number, string[]>()

  const descrever = (a: LinhaAula) => {
    const antigo = anterior.get(a.id)
    const previsto = antigo
      ? antigo.status === 'vaga' || !antigo.disciplinaAtualId
        ? 'Sem aula'
        : `${n.disciplina(antigo.disciplinaAtualId)} — ${n.pessoa(antigo.professorAtualId)}${antigo.status === 'cancelada' ? ' (cancelada)' : ''}`
      : 'Sem aula'
    const linhas = [
      `Aula prevista: ${previsto}`,
      a.status === 'cancelada' || a.status === 'vaga' ? `Situação: ${descreverSituacao(a, n)}` : `Aula que será ministrada: ${descreverSituacao(a, n)}`,
    ]
    if (a.sala && a.status === 'normal') linhas.push(`Sala: ${a.sala}`)
    return linhas.join('\n')
  }

  // Agrupa por turma e noite.
  const noites = new Map<string, LinhaAula[]>()
  for (const a of [...depois].sort((x, y) => (x.data + x.horario).localeCompare(y.data + y.horario))) {
    const k = `${a.turmaId}|${a.data}`
    noites.set(k, [...(noites.get(k) ?? []), a])
  }

  for (const linhas of noites.values()) {
    const { turmaId, data } = linhas[0]
    const dia = `${NOMES_DIAS[diaDaSemana(data)]}, ${formatarData(data)}`
    const textos = linhas.map(descrever)
    const blocos =
      // Os dois horários iguais (o caso normal): um bloco só para a noite inteira.
      new Set(textos).size === 1
        ? [`Data: ${dia} — noite inteira (${HORARIOS[1].inicio}–${HORARIOS[2].fim})\n${textos[0]}`]
        : linhas.map((a, i) => `Data: ${dia} — ${descreverHorario(a.horario)}\n${textos[i]}`)
    porTurma.set(turmaId, [...(porTurma.get(turmaId) ?? []), ...blocos])
  }

  return [...porTurma.entries()].map(
    ([turmaId, blocos]) => `*Alteração de aula — ${n.turma(turmaId)}*\n\n${blocos.join('\n\n')}\n\n_Informativo gerado pelo sistema Permuta Acadêmica._`,
  )
}
