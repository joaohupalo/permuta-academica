import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Contexto } from '../../contexto.js'
import { usuario } from '../../db/schema.js'
import { ErroRegra } from '../../compartilhado/erros.js'
import { autenticar } from './guardas.js'

export function rotasAuth(app: FastifyInstance, { db }: Contexto) {
  app.post('/auth/login', async (req) => {
    const { email, senha } = z.object({ email: z.string().trim().toLowerCase(), senha: z.string() }).parse(req.body)
    const u = db.select().from(usuario).where(eq(usuario.email, email)).get()
    if (!u || !bcrypt.compareSync(senha, u.senhaHash)) throw new ErroRegra(401, 'E-mail ou senha incorretos.')
    const dados = { id: u.id, nome: u.nome, papel: u.papel }
    return { token: app.jwt.sign(dados, { expiresIn: '7d' }), usuario: { ...dados, email: u.email } }
  })

  app.get('/auth/eu', { preHandler: autenticar }, async (req) => {
    const u = db.select().from(usuario).where(eq(usuario.id, req.user.id)).get()
    if (!u) throw new ErroRegra(401, 'Sessão inválida.')
    return { id: u.id, nome: u.nome, email: u.email, papel: u.papel }
  })

  /** Lista de contas para a tela de login da demonstração. */
  app.get('/auth/contas-demo', async () =>
    db.select({ nome: usuario.nome, email: usuario.email, papel: usuario.papel }).from(usuario).orderBy(usuario.papel, usuario.nome).all(),
  )
}
