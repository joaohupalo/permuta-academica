import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Contexto } from '../../contexto.js'
import { autenticar } from '../auth/guardas.js'
import { calcularSaldo } from './calcular.js'
import { calcularAcertos } from './acertos.js'

export function rotasSaldo(app: FastifyInstance, ctx: Contexto) {
  app.get('/saldo', { preHandler: autenticar }, async (req) => {
    const q = z
      .object({ professorId: z.coerce.number().int().optional(), turmaId: z.coerce.number().int().optional() })
      .parse(req.query)
    return calcularSaldo(ctx).filter((l) => (!q.professorId || l.professorId === q.professorId) && (!q.turmaId || l.turmaId === q.turmaId))
  })

  app.get('/acertos', { preHandler: autenticar }, async () => calcularAcertos(ctx))
}
