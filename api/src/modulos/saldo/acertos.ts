import type { Contexto } from '../../contexto.js'
import { aula } from '../../db/schema.js'
import { calcularSaldo, type LinhaSaldo } from './calcular.js'

interface Parte {
  disciplinaId: number
  disciplina: string
  professorId: number
  professor: string
}

export interface Acerto {
  turmaId: number
  turma: string
  aulas: number
  devedor: Parte | null
  credor: Parte | null
  /** ceder: o credor cede uma noite ao devedor · repor: o devedor repõe numa noite vaga · cancelar: aula adiantada, o credor cancela uma noite futura (RN-12) */
  acao: 'ceder' | 'repor' | 'cancelar'
}

const parte = (l: LinhaSaldo): Parte => ({ disciplinaId: l.disciplinaId, disciplina: l.disciplina, professorId: l.professorId, professor: l.professor })

/**
 * Acerto de contas (RF-20, spec §7.1): por turma, casa quem deve com quem tem crédito.
 * Os valores vêm do saldo (fonte da verdade); o histórico de trocas só decide a preferência de quem casa com quem.
 */
export function calcularAcertos(ctx: Contexto): Acerto[] {
  const saldo = calcularSaldo(ctx)

  // Quem cobriu quem: aula que acontece com disciplina atual diferente da responsável.
  const historico = new Map<string, number>()
  for (const a of ctx.db.select().from(aula).all()) {
    if (a.status !== 'normal' || !a.disciplinaResponsavelId || !a.disciplinaAtualId || a.disciplinaResponsavelId === a.disciplinaAtualId) continue
    const k = `${a.turmaId}|${a.disciplinaResponsavelId}|${a.disciplinaAtualId}`
    historico.set(k, (historico.get(k) ?? 0) + 1)
  }

  const resultado: Acerto[] = []
  for (const turmaId of new Set(saldo.map((l) => l.turmaId))) {
    const daTurma = saldo.filter((l) => l.turmaId === turmaId)
    const turma = daTurma[0].turma
    const devedores = daTurma.filter((l) => l.saldo < 0).map((l) => ({ l, resta: -l.saldo }))
    const credores = daTurma.filter((l) => l.saldo > 0).map((l) => ({ l, resta: l.saldo }))

    // Pares possíveis, primeiro os que já trocaram entre si.
    const pares = devedores
      .flatMap((d) => credores.map((c) => ({ d, c, peso: historico.get(`${turmaId}|${d.l.disciplinaId}|${c.l.disciplinaId}`) ?? 0 })))
      .sort((x, y) => y.peso - x.peso)
    for (const { d, c } of pares) {
      const q = Math.min(d.resta, c.resta)
      if (q <= 0) continue
      resultado.push({ turmaId, turma, aulas: q, devedor: parte(d.l), credor: parte(c.l), acao: 'ceder' })
      d.resta -= q
      c.resta -= q
    }
    for (const d of devedores) if (d.resta > 0) resultado.push({ turmaId, turma, aulas: d.resta, devedor: parte(d.l), credor: null, acao: 'repor' })
    // Crédito sem devedor = aula adiantada: zera cancelando uma noite futura (RN-12).
    for (const c of credores) if (c.resta > 0) resultado.push({ turmaId, turma, aulas: c.resta, devedor: null, credor: parte(c.l), acao: 'cancelar' })
  }
  return resultado.sort((x, y) => x.turma.localeCompare(y.turma))
}
