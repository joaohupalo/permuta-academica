import { eq } from 'drizzle-orm'
import type { Contexto } from '../../contexto.js'
import { aula, disciplina, disciplinaTurma, turma, usuario } from '../../db/schema.js'
import { fimDaAula } from '../../compartilhado/horarios.js'

export interface LinhaSaldo {
  disciplinaId: number
  disciplina: string
  professorId: number
  professor: string
  turmaId: number
  turma: string
  totalAulas: number
  previstas: number
  ministradas: number
  cedidas: number
  assumidas: number
  canceladas: number
  saldo: number
  situacao: 'a repor' | 'em dia' | 'crédito'
}

/**
 * Saldo por disciplina e turma (spec, seção 7). Sempre calculado a partir das aulas:
 * não existe valor guardado que precise ser "recalculado".
 */
export function calcularSaldo(ctx: Contexto): LinhaSaldo[] {
  const { db } = ctx
  const agora = ctx.agora()
  const pares = db
    .select({
      disciplinaId: disciplina.id,
      disciplina: disciplina.nome,
      professorId: disciplina.professorId,
      professor: usuario.nome,
      totalAulas: disciplina.totalAulas,
      turmaId: turma.id,
      turma: turma.nome,
    })
    .from(disciplinaTurma)
    .innerJoin(disciplina, eq(disciplina.id, disciplinaTurma.disciplinaId))
    .innerJoin(turma, eq(turma.id, disciplinaTurma.turmaId))
    .innerJoin(usuario, eq(usuario.id, disciplina.professorId))
    .all()

  const saldo = new Map<string, LinhaSaldo>()
  for (const p of pares) {
    saldo.set(`${p.disciplinaId}|${p.turmaId}`, {
      ...p,
      previstas: 0,
      ministradas: 0,
      cedidas: 0,
      assumidas: 0,
      canceladas: 0,
      saldo: 0,
      situacao: 'em dia',
    })
  }
  const de = (disciplinaId: number | null, turmaId: number) => (disciplinaId ? saldo.get(`${disciplinaId}|${turmaId}`) : undefined)

  for (const a of db.select().from(aula).all()) {
    const encerrada = fimDaAula(a.data, a.horario) <= agora
    const prevista = de(a.disciplinaPrevistaId, a.turmaId)
    const atual = de(a.disciplinaAtualId, a.turmaId)

    if (prevista) prevista.previstas++
    if (a.status === 'feriado' && encerrada && prevista) prevista.ministradas++
    if (a.status === 'normal' && encerrada && atual) atual.ministradas++
    if (prevista && a.disciplinaAtualId !== a.disciplinaPrevistaId) prevista.cedidas++
    if (atual && a.disciplinaPrevistaId !== a.disciplinaAtualId) atual.assumidas++
    if (a.status === 'cancelada' && atual) atual.canceladas++
  }

  return [...saldo.values()]
    .map((l) => {
      const s = l.assumidas - l.cedidas - l.canceladas
      return { ...l, saldo: s, situacao: s < 0 ? ('a repor' as const) : s > 0 ? ('crédito' as const) : ('em dia' as const) }
    })
    .sort((x, y) => x.turma.localeCompare(y.turma) || x.disciplina.localeCompare(y.disciplina))
}
