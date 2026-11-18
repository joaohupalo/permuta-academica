import type { FastifyInstance } from 'fastify'
import { and, desc, eq, gte, inArray, lte, or, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { z } from 'zod'
import type { Contexto } from '../../contexto.js'
import { aula, disciplina, evento, pedido, STATUS_PEDIDO, turma, usuario } from '../../db/schema.js'
import { autenticar } from '../auth/guardas.js'
import { classificar } from './consultas.js'
import { candidatos, cancelarAula, contrapartidas, criarPedido, noitesVagas, reporAula, responderPedido } from './servico.js'

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato AAAA-MM-DD')
const id = z.coerce.number().int().positive()

export function rotasTrocas(app: FastifyInstance, ctx: Contexto) {
  const { db } = ctx
  const opt = { preHandler: autenticar }

  /** Grade: aulas de um período, com nomes e classificação. professorId traz aulas atuais ou previstas do professor. */
  app.get('/aulas', opt, async (req) => {
    const q = z
      .object({ inicio: data, fim: data, professorId: id.optional(), turmaId: id.optional() })
      .parse(req.query)
    const prevista = alias(disciplina, 'prevista')
    const atual = alias(disciplina, 'atual')
    const profAtual = alias(usuario, 'prof_atual')
    const profPrevisto = alias(usuario, 'prof_previsto')

    const filtros: SQL[] = [gte(aula.data, q.inicio), lte(aula.data, q.fim)]
    if (q.turmaId) filtros.push(eq(aula.turmaId, q.turmaId))
    if (q.professorId) filtros.push(or(eq(aula.professorAtualId, q.professorId), eq(prevista.professorId, q.professorId))!)

    const linhas = db
      .select({
        aula,
        turma: turma.nome,
        curso: turma.curso,
        atual: atual.nome,
        prevista: prevista.nome,
        professorAtual: profAtual.nome,
        professorPrevisto: profPrevisto.nome,
        professorPrevistoId: prevista.professorId,
      })
      .from(aula)
      .innerJoin(turma, eq(turma.id, aula.turmaId))
      .leftJoin(atual, eq(atual.id, aula.disciplinaAtualId))
      .leftJoin(prevista, eq(prevista.id, aula.disciplinaPrevistaId))
      .leftJoin(profAtual, eq(profAtual.id, aula.professorAtualId))
      .leftJoin(profPrevisto, eq(profPrevisto.id, prevista.professorId))
      .where(and(...filtros))
      .orderBy(aula.data, aula.horario, turma.curso, turma.nome)
      .all()

    return linhas.map((l) => ({
      ...l.aula,
      tipo: classificar(l.aula),
      travada: l.aula.pedidoPendenteId !== null,
      turma: l.turma,
      curso: l.curso,
      disciplinaAtual: l.atual,
      disciplinaPrevista: l.prevista,
      professorAtual: l.professorAtual,
      professorPrevisto: l.professorPrevisto,
      professorPrevistoId: l.professorPrevistoId,
    }))
  })

  app.get('/aulas/:id/candidatos', opt, async (req) => candidatos(ctx, req.user.id, z.object({ id }).parse(req.params).id))

  app.get('/aulas/:id/contrapartidas', opt, async (req) => {
    const { professorId } = z.object({ professorId: id }).parse(req.query)
    return contrapartidas(ctx, req.user.id, z.object({ id }).parse(req.params).id, professorId)
  })

  app.get('/noites-vagas', opt, async (req) => {
    const q = z.object({ disciplinaId: id, turmaId: id.optional() }).parse(req.query)
    return noitesVagas(ctx, req.user.id, q.disciplinaId, q.turmaId)
  })

  app.post('/pedidos', opt, async (req, res) => {
    const corpo = z
      .object({
        tipo: z.enum(['compensatoria', 'pontual']),
        aulaId: id,
        destinatarioId: id,
        aulaPedidaId: id.optional(),
        disciplinaDestinoId: id.optional(),
      })
      .parse(req.body)
    return res.status(201).send(criarPedido(ctx, req.user, corpo))
  })

  app.get('/pedidos', opt, async (req) => {
    const q = z
      .object({ caixa: z.enum(['recebidos', 'enviados', 'todos']).default('todos'), status: z.enum(STATUS_PEDIDO).optional() })
      .parse(req.query)
    const solicitante = alias(usuario, 'solicitante')
    const destinatario = alias(usuario, 'destinatario')
    const filtros: SQL[] = []
    if (q.caixa === 'recebidos') filtros.push(eq(pedido.destinatarioId, req.user.id))
    if (q.caixa === 'enviados') filtros.push(eq(pedido.solicitanteId, req.user.id))
    if (q.status) filtros.push(eq(pedido.status, q.status))
    const linhas = db
      .select({ pedido, solicitante: solicitante.nome, destinatario: destinatario.nome })
      .from(pedido)
      .innerJoin(solicitante, eq(solicitante.id, pedido.solicitanteId))
      .innerJoin(destinatario, eq(destinatario.id, pedido.destinatarioId))
      .where(filtros.length ? and(...filtros) : undefined)
      .orderBy(desc(pedido.id))
      .limit(200)
      .all()

    const ids = linhas.map((l) => l.pedido.id)
    const informativos = new Map(
      ids.length
        ? db
            .select({ pedidoId: evento.pedidoId, dados: evento.dados })
            .from(evento)
            .where(and(inArray(evento.pedidoId, ids), eq(evento.tipo, 'pedido_aprovado')))
            .all()
            .map((e) => [e.pedidoId, e.dados?.informativo ?? []])
        : [],
    )
    return linhas.map((l) => ({
      ...l.pedido,
      solicitante: l.solicitante,
      destinatario: l.destinatario,
      informativo: informativos.get(l.pedido.id) ?? null,
    }))
  })

  for (const acao of ['aprovar', 'recusar', 'cancelar'] as const) {
    app.post(`/pedidos/:id/${acao}`, opt, async (req) => responderPedido(ctx, req.user, z.object({ id }).parse(req.params).id, acao))
  }

  app.post('/reposicoes', opt, async (req, res) => {
    const corpo = z
      .object({ disciplinaId: id, turmaId: id, data, sala: z.string().trim().max(40).optional() })
      .parse(req.body)
    return res.status(201).send(reporAula(ctx, req.user, corpo))
  })

  app.post('/aulas/:id/cancelar', opt, async (req) => {
    const { motivo } = z.object({ motivo: z.string().default('') }).parse(req.body ?? {})
    return cancelarAula(ctx, req.user, z.object({ id }).parse(req.params).id, motivo)
  })
}
