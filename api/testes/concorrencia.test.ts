import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { aula, pedido } from '../src/db/schema.js'
import { criarAmbiente, pedidoAnaBruno } from './ambiente.js'

const REPETICOES = 50

describe('Concorrência', () => {
  it(`CA-14: dois pedidos simultâneos sobre a mesma noite — só um vence (${REPETICOES} repetições)`, async () => {
    for (let i = 0; i < REPETICOES; i++) {
      const amb = await criarAmbiente()
      const [a, b] = await Promise.all([
        pedidoAnaBruno(amb),
        amb.como('Carla Mendes').post('/pedidos', {
          tipo: 'compensatoria',
          aulaId: amb.aulaEm('SI 4º', '2026-11-24', 1).id,
          destinatarioId: amb.idPessoa('Bruno Lima'),
          aulaPedidaId: amb.aulaEm('SI 4º', '2026-11-25', 1).id,
        }),
      ])
      expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409])
      const pendentes = amb.db.select().from(pedido).where(eq(pedido.status, 'pendente')).all()
      expect(pendentes).toHaveLength(1)
      const travadas = amb.db.select().from(aula).all().filter((x) => x.pedidoPendenteId !== null)
      expect(travadas).toHaveLength(4) // duas noites × dois horários
      expect(travadas.every((x) => x.pedidoPendenteId === pendentes[0].id)).toBe(true)
    }
  })

  it(`CA-14: aprovações simultâneas do mesmo pedido — aplicada uma vez (${REPETICOES} repetições)`, async () => {
    for (let i = 0; i < REPETICOES; i++) {
      const amb = await criarAmbiente()
      const p = (await pedidoAnaBruno(amb)).json()
      const respostas = await Promise.all([
        amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`),
        amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`),
        amb.como('Bruno Lima').post(`/pedidos/${p.id}/recusar`),
      ])
      expect(respostas.filter((r) => r.statusCode === 200)).toHaveLength(1)
      expect(respostas.filter((r) => r.statusCode === 409)).toHaveLength(2)
      expect(amb.db.select().from(pedido).where(eq(pedido.id, p.id)).get()!.status).toBe('aprovado')
      expect(amb.aulaEm('SI 4º', '2026-11-26', 2).disciplinaAtualId).toBe(amb.idDisciplina('Engenharia de Software'))
      expect(amb.db.select().from(aula).all().some((x) => x.pedidoPendenteId !== null)).toBe(false)
    }
  })

  it('CA-14: duas reposições simultâneas na mesma noite vaga — só uma é criada', async () => {
    const amb = await criarAmbiente()
    await amb.como('Ana Souza').post(`/aulas/${amb.aulaEm('SI 4º', '2026-11-26', 1).id}/cancelar`, { motivo: 'Consulta' }) // Ana passa a dever 2
    const corpo = { disciplinaId: amb.idDisciplina('Banco de Dados II'), turmaId: amb.idTurma('SI 4º'), data: '2026-11-27' }
    const [a, b] = await Promise.all([amb.como('Ana Souza').post('/reposicoes', corpo), amb.como('Ana Souza').post('/reposicoes', corpo)])
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409])
    expect([...amb.aulasEm('SI 4º', '2026-11-27', 1), ...amb.aulasEm('SI 4º', '2026-11-27', 2)]).toHaveLength(2)
  })
})
