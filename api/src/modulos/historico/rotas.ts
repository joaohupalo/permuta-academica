import type { FastifyInstance } from 'fastify'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Contexto } from '../../contexto.js'
import { evento, usuario } from '../../db/schema.js'
import { autenticar } from '../auth/guardas.js'

export function rotasHistorico(app: FastifyInstance, { db }: Contexto) {
  app.get('/historico', { preHandler: autenticar }, async (req) => {
    const { limite } = z.object({ limite: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query)
    return db
      .select({
        id: evento.id,
        quando: evento.quando,
        tipo: evento.tipo,
        descricao: evento.descricao,
        pedidoId: evento.pedidoId,
        dados: evento.dados,
        usuario: usuario.nome,
      })
      .from(evento)
      .leftJoin(usuario, eq(usuario.id, evento.usuarioId))
      .orderBy(desc(evento.id))
      .limit(limite)
      .all()
  })
}
