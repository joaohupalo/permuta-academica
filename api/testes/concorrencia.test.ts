import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { aula, pedido } from '../src/db/schema.js'
import { criarAmbiente, pedidoAnaBruno } from './ambiente.js'

const REPETICOES = 50

describe('Concorrência', () => {
  it(`CA-14: dois pedidos simultâneos sobre a mesma aula — só um vence (${REPETICOES} repetições)`, async () => {
    for (let i = 0; i < REPETICOES; i++) {
      const amb = await criarAmbiente()
      const aulaBruno = amb.aulaEm('SI 4º', '2026-11-18', 1)
      const [a, b] = await Promise.all([
        pedidoAnaBruno(amb),
        amb.como('Fernanda Dias').post('/pedidos', {
          tipo: 'compensatoria',
          aulaId: amb.aulaEm('SI 4º', '2026-11-23', 1).id,
          destinatarioId: amb.idPessoa('Bruno Lima'),
          aulaPedidaId: aulaBruno.id,
        }),
      ])
      const codigos = [a.statusCode, b.statusCode].sort()
      expect(codigos).toEqual([201, 409])
      // Nenhuma inconsistência: um único pedido pendente, e todas as aulas travadas apontam para ele
      const pendentes = amb.db.select().from(pedido).where(eq(pedido.status, 'pendente')).all()
      expect(pendentes).toHaveLength(1)
      const travadas = amb.db.select().from(aula).all().filter((x) => x.pedidoPendenteId !== null)
      expect(travadas).toHaveLength(2)
      expect(travadas.every((x) => x.pedidoPendenteId === pendentes[0].id)).toBe(true)
    }
  })

  it(`CA-14: duas aprovações simultâneas do mesmo pedido — aplicada uma vez (${REPETICOES} repetições)`, async () => {
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
      const final = amb.db.select().from(pedido).where(eq(pedido.id, p.id)).get()!
      expect(final.status).toBe('aprovado')
      // Saldo consistente: a troca foi aplicada exatamente uma vez
      const bd = await amb.saldoDe('Banco de Dados II', 'SI 4º')
      expect([bd.cedidas, bd.assumidas]).toEqual([1, 1])
      expect(amb.db.select().from(aula).all().some((x) => x.pedidoPendenteId !== null)).toBe(false)
    }
  })

  it('CA-14: duas reposições simultâneas no mesmo horário vago — só uma é criada', async () => {
    const amb = await criarAmbiente()
    const corpo = { disciplinaId: amb.idDisciplina('Banco de Dados II'), turmaId: amb.idTurma('SI 4º'), data: '2026-11-27', horario: 2 }
    const [a, b] = await Promise.all([amb.como('Ana Souza').post('/reposicoes', corpo), amb.como('Ana Souza').post('/reposicoes', corpo)])
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409])
    expect(amb.aulasEm('SI 4º', '2026-11-27', 2)).toHaveLength(1)
  })
})
