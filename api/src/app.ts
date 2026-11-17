import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { ZodError } from 'zod'
import type { Banco } from './db/conexao.js'
import type { Contexto } from './contexto.js'
import { ErroRegra } from './compartilhado/erros.js'
import { Hub } from './modulos/eventos/hub.js'
import { rotasAuth } from './modulos/auth/rotas.js'
import { rotasHistorico } from './modulos/historico/rotas.js'
import { rotasTrocas } from './modulos/trocas/rotas.js'
import { rotasSaldo } from './modulos/saldo/rotas.js'
import { rotasPainel } from './modulos/painel/rotas.js'
import { rotasCadastros } from './modulos/cadastros/rotas.js'
import { expirarPedidos } from './modulos/trocas/servico.js'

export interface OpcoesApp {
  db: Banco
  agora?: () => Date
  segredoJwt?: string
  log?: boolean
}

/** Monta a API. Usado pelo servidor real e pelos testes (com banco em memória e relógio fixo). */
export function criarApp(opcoes: OpcoesApp) {
  const app = Fastify({ logger: opcoes.log ?? false })
  const ctx: Contexto = { db: opcoes.db, agora: opcoes.agora ?? (() => new Date()), hub: new Hub() }

  app.register(jwt, { secret: opcoes.segredoJwt ?? process.env.JWT_SEGREDO ?? 'segredo-de-desenvolvimento-troque-em-producao' })

  app.setErrorHandler((erro, _req, res) => {
    if (erro instanceof ErroRegra) return res.status(erro.status).send({ erro: erro.message })
    if (erro instanceof ZodError) {
      const p = erro.issues[0]
      return res.status(400).send({ erro: `Dado inválido${p.path.length ? ` em "${p.path.join('.')}"` : ''}: ${p.message}` })
    }
    const msg = String((erro as Error).message ?? '')
    if (msg.includes('UNIQUE constraint failed')) return res.status(409).send({ erro: 'Já existe um registro com esses dados.' })
    if (msg.includes('FOREIGN KEY constraint failed'))
      return res.status(409).send({ erro: 'Este registro está em uso e não pode ser removido.' })
    app.log.error(erro)
    return res.status(500).send({ erro: 'Erro inesperado no servidor.' })
  })

  app.register(
    async (api) => {
      // RN-07: antes de cada requisição, expira pedidos cujas aulas já começaram.
      api.addHook('onRequest', async (req) => {
        if (req.url.startsWith('/api/eventos')) return
        if (expirarPedidos(ctx) > 0) ctx.hub.publicar('pedidos', 'aulas')
      })

      api.get('/eventos', (req, res) => {
        res.hijack()
        ctx.hub.conectar(res.raw)
      })
      api.get('/saude', async () => ({ ok: true, agora: ctx.agora().toISOString() }))

      rotasAuth(api, ctx)
      rotasHistorico(api, ctx)
      rotasTrocas(api, ctx)
      rotasSaldo(api, ctx)
      rotasPainel(api, ctx)
      rotasCadastros(api, ctx)
    },
    { prefix: '/api' },
  )

  return Object.assign(app, { ctx })
}
