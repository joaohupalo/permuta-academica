import { describe, expect, it } from 'vitest'
import { criarAmbiente, pedidoAnaBruno } from './ambiente.js'

describe('Informativo', () => {
  it('CA-18: troca aprovada gera informativo por turma com data, horários, aula prevista e ministrada', async () => {
    const amb = await criarAmbiente()
    const p = (await pedidoAnaBruno(amb)).json()
    const r = (await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)).json()
    expect(r.informativo).toHaveLength(1)
    const texto: string = r.informativo[0]
    expect(texto).toContain('Alteração de aula — SI 4º')
    expect(texto).toContain('quarta-feira, 25/11/2026 — 1º horário (19:10–20:25)')
    expect(texto).toContain('quarta-feira, 25/11/2026 — 2º horário (20:45–22:00)')
    expect(texto).toContain('Aula prevista: Engenharia de Software — Bruno Lima')
    expect(texto).toContain('Aula que será ministrada: Banco de Dados II — Ana Souza')
    expect(texto).toContain('quinta-feira, 26/11/2026')
    const lista = (await amb.como('Ana Souza').get('/pedidos?caixa=enviados')).json() as any[]
    expect(lista.find((x) => x.id === p.id).informativo).toEqual(r.informativo)
  })

  it('CA-18: noite compartilhada gera um informativo para cada turma', async () => {
    const amb = await criarAmbiente()
    const p = (
      await amb.como('Hélio Martins').post('/pedidos', {
        tipo: 'pontual',
        aulaId: amb.aulaEm('SI 4º', '2026-11-30', 1).id,
        destinatarioId: amb.idPessoa('Bruno Lima'),
        disciplinaDestinoId: amb.idDisciplina('Engenharia de Software'),
      })
    ).json()
    const r = (await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)).json()
    expect(r.informativo).toHaveLength(2)
    expect(r.informativo.find((t: string) => t.includes('ADS 4º'))).toContain('Sem aula neste horário')
  })
})
