import type { FastifyInstance } from 'fastify'
import { and, eq, gte, lte } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { z } from 'zod'
import type { Contexto } from '../../contexto.js'
import { aula, disciplina, feriado, turma, usuario } from '../../db/schema.js'
import { HORARIOS, NOMES_DIAS, diaDaSemana, paraISO, segundaDaSemana, somarDias } from '../../compartilhado/horarios.js'
import { classificar } from '../trocas/consultas.js'

/**
 * Painel público da TV do saguão (RF-16, RF-17): semana de todas as turmas de SI e ADS.
 * Também é a API que o sistema real da TV consumiria.
 */
export function rotasPainel(app: FastifyInstance, ctx: Contexto) {
  const { db } = ctx
  app.get('/painel', async (req) => {
    const q = z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.query)
    const hoje = q.data ?? paraISO(ctx.agora())
    const inicio = segundaDaSemana(hoje)
    const fim = somarDias(inicio, 4)

    const feriados = new Map(
      db
        .select()
        .from(feriado)
        .where(and(gte(feriado.data, inicio), lte(feriado.data, fim)))
        .all()
        .map((f) => [f.data, f.descricao]),
    )
    const dias = [0, 1, 2, 3, 4].map((i) => {
      const d = somarDias(inicio, i)
      return { data: d, nome: NOMES_DIAS[diaDaSemana(d)], feriado: feriados.get(d) ?? null }
    })

    const prevista = alias(disciplina, 'prevista')
    const atual = alias(disciplina, 'atual')
    const profAtual = alias(usuario, 'prof_atual')
    const profPrevisto = alias(usuario, 'prof_previsto')
    const linhas = db
      .select({
        aula,
        atual: atual.nome,
        professor: profAtual.nome,
        prevista: prevista.nome,
        professorPrevisto: profPrevisto.nome,
      })
      .from(aula)
      .leftJoin(atual, eq(atual.id, aula.disciplinaAtualId))
      .leftJoin(prevista, eq(prevista.id, aula.disciplinaPrevistaId))
      .leftJoin(profAtual, eq(profAtual.id, aula.professorAtualId))
      .leftJoin(profPrevisto, eq(profPrevisto.id, prevista.professorId))
      .where(and(gte(aula.data, inicio), lte(aula.data, fim)))
      .all()

    // Se uma reposição ocupou o horário de uma aula cancelada, a TV mostra a reposição "no lugar" da cancelada.
    const chave = (l: (typeof linhas)[number]) => `${l.aula.turmaId}|${l.aula.data}|${l.aula.horario}`
    const ativas = new Set(linhas.filter((l) => l.aula.status !== 'cancelada').map(chave))
    const canceladas = new Map(linhas.filter((l) => l.aula.status === 'cancelada').map((l) => [chave(l), l]))
    const visiveis = linhas.filter((l) => l.aula.status !== 'cancelada' || !ativas.has(chave(l)))

    return {
      hoje,
      semana: { inicio, fim },
      horarios: HORARIOS,
      dias,
      turmas: db.select().from(turma).orderBy(turma.curso, turma.nome).all().sort((a, b) => b.curso.localeCompare(a.curso) || a.nome.localeCompare(b.nome)),
      aulas: visiveis.map((l) => {
        const substituida = canceladas.get(chave(l))
        return {
          turmaId: l.aula.turmaId,
          data: l.aula.data,
          horario: l.aula.horario,
          sala: l.aula.sala,
          tipo: classificar(l.aula),
          disciplina: l.atual,
          professor: l.professor,
          previsto:
            l.aula.status !== 'cancelada' && substituida
              ? { disciplina: `${substituida.atual} (cancelada)`, professor: substituida.professor }
              : l.aula.disciplinaPrevistaId !== l.aula.disciplinaAtualId && l.prevista
                ? { disciplina: l.prevista, professor: l.professorPrevisto }
                : null,
          motivo: l.aula.motivo,
        }
      }),
    }
  })
}
