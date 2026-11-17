import { describe, expect, it } from 'vitest'
import { criarAmbiente } from './ambiente.js'

describe('Acesso', () => {
  it('CA-20: área autenticada exige login; painel da TV é público', async () => {
    const amb = await criarAmbiente()
    expect((await amb.app.inject({ url: '/api/aulas?inicio=2026-11-16&fim=2026-11-20' })).statusCode).toBe(401)
    expect((await amb.app.inject({ url: '/api/pedidos' })).statusCode).toBe(401)
    expect((await amb.app.inject({ url: '/api/painel' })).statusCode).toBe(200)
  })

  it('CA-20: senha errada é recusada; professor não acessa cadastros da coordenação', async () => {
    const amb = await criarAmbiente()
    const r = await amb.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'ana.souza@unimater.edu', senha: 'errada' } })
    expect(r.statusCode).toBe(401)
    expect((await amb.como('Ana Souza').post('/turmas', { nome: 'X', curso: 'SI' })).statusCode).toBe(403)
    expect((await amb.como('coordenacao').post('/turmas', { nome: 'SI 10º', curso: 'SI' })).statusCode).toBe(201)
  })
})
