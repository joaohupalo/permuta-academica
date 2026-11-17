import { describe, expect, it } from 'vitest'
import { criarAmbiente, pedidoAnaBruno } from './ambiente.js'

describe('Tempo real e painel da TV', () => {
  it('CA-17: aprovação publica aviso e o painel passa a mostrar a troca destacada', async () => {
    const amb = await criarAmbiente()
    const avisos: string[][] = []
    amb.app.ctx.hub.ouvir((c) => avisos.push(c))

    const p = (await pedidoAnaBruno(amb)).json()
    expect(avisos.at(-1)).toEqual(['pedidos', 'aulas'])
    await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)
    expect(avisos.at(-1)).toEqual(['pedidos', 'aulas'])

    const painel = (await amb.app.inject({ url: '/api/painel?data=2026-11-18' })).json()
    expect(painel.semana).toEqual({ inicio: '2026-11-16', fim: '2026-11-20' })
    expect(painel.dias.find((d: any) => d.data === '2026-11-20').feriado).toBe('Dia da Consciência Negra')
    const quarta = painel.aulas.find((a: any) => a.turmaId === amb.idTurma('SI 4º') && a.data === '2026-11-18' && a.horario === 1)
    expect(quarta).toMatchObject({
      tipo: 'troca',
      disciplina: 'Banco de Dados II',
      professor: 'Ana Souza',
      previsto: { disciplina: 'Engenharia de Software', professor: 'Bruno Lima' },
    })
  })

  it('RF-16: no fim de semana o painel mostra a semana seguinte', async () => {
    const amb = await criarAmbiente()
    const painel = (await amb.app.inject({ url: '/api/painel?data=2026-11-21' })).json()
    expect(painel.semana.inicio).toBe('2026-11-23')
  })
})
