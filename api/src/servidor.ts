import { abrirBanco } from './db/conexao.js'
import { criarApp } from './app.js'
import { expirarPedidos } from './modulos/trocas/servico.js'

const ARQUIVO = process.env.BANCO ?? 'dados.db'
const PORTA = Number(process.env.PORTA ?? 3333)

const app = criarApp({ db: abrirBanco(ARQUIVO), log: true })

// RN-07: a cada minuto, expira pedidos cujas aulas começaram e avisa as telas.
setInterval(() => {
  if (expirarPedidos(app.ctx) > 0) app.ctx.hub.publicar('pedidos', 'aulas')
}, 60_000)

app.listen({ port: PORTA, host: '0.0.0.0' }).then(() => {
  console.log(`\n  API pronta em http://localhost:${PORTA}/api  ·  banco: ${ARQUIVO}\n`)
})
