import { describe, expect, it } from 'vitest'
import { criarAmbiente, pedidoAnaBruno, pontualAnaBruno } from './ambiente.js'

const saldo = (s: any) => ({ cedidas: s.cedidas, assumidas: s.assumidas, saldo: s.saldo })

describe('Resposta a pedidos', () => {
  it('CA-05: compensatória aprovada troca as noites e ninguém fica com cedida nem assumida', async () => {
    const amb = await criarAmbiente()
    const p = (await pedidoAnaBruno(amb)).json()
    expect((await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)).statusCode).toBe(200)

    for (const h of [1, 2]) {
      const quinta = amb.aulaEm('SI 4º', '2026-11-26', h)
      const quarta = amb.aulaEm('SI 4º', '2026-11-25', h)
      expect(quinta.disciplinaAtualId).toBe(amb.idDisciplina('Engenharia de Software'))
      expect(quinta.professorAtualId).toBe(amb.idPessoa('Bruno Lima'))
      expect(quarta.disciplinaAtualId).toBe(amb.idDisciplina('Banco de Dados II'))
      expect(quarta.professorAtualId).toBe(amb.idPessoa('Ana Souza'))
      expect(quinta.pedidoPendenteId).toBeNull()
    }
    const historico = (await amb.como('Ana Souza').get('/historico')).json() as any[]
    expect(historico.some((e) => e.tipo === 'pedido_aprovado' && e.pedidoId === p.id)).toBe(true)

    expect(saldo(await amb.saldoDe('Banco de Dados II', 'SI 4º'))).toEqual({ cedidas: 0, assumidas: 0, saldo: 0 })
    expect(saldo(await amb.saldoDe('Engenharia de Software', 'SI 4º'))).toEqual({ cedidas: 0, assumidas: 0, saldo: 0 })
  })

  it('CA-06: pontual aprovada deixa −2 para quem cedeu a noite e +2 para quem assumiu', async () => {
    const amb = await criarAmbiente()
    const p = (await pontualAnaBruno(amb)).json()
    expect((await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)).statusCode).toBe(200)
    const bd = await amb.saldoDe('Banco de Dados II', 'SI 4º')
    const es = await amb.saldoDe('Engenharia de Software', 'SI 4º')
    expect([bd.cedidas, bd.saldo, bd.situacao]).toEqual([2, -2, 'a repor'])
    expect([es.assumidas, es.saldo, es.situacao]).toEqual([2, 2, 'crédito'])
  })

  it('CA-05/CA-06: depois de uma compensatória, ceder a noite recebida debita quem cedeu (não o dono original)', async () => {
    const amb = await criarAmbiente()
    const p = (await pedidoAnaBruno(amb)).json()
    await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)
    // A quinta agora é do Bruno. Ele a cede ao Hélio (Ética, também do SI 4º).
    const p2 = (
      await amb.como('Bruno Lima').post('/pedidos', {
        tipo: 'pontual',
        aulaId: amb.aulaEm('SI 4º', '2026-11-26', 1).id,
        destinatarioId: amb.idPessoa('Hélio Martins'),
        disciplinaDestinoId: amb.idDisciplina('Ética e Legislação em TI'),
      })
    ).json()
    expect((await amb.como('Hélio Martins').post(`/pedidos/${p2.id}/aprovar`)).statusCode).toBe(200)
    expect(saldo(await amb.saldoDe('Engenharia de Software', 'SI 4º'))).toEqual({ cedidas: 2, assumidas: 0, saldo: -2 })
    expect(saldo(await amb.saldoDe('Banco de Dados II', 'SI 4º'))).toEqual({ cedidas: 0, assumidas: 0, saldo: 0 })
    expect(saldo(await amb.saldoDe('Ética e Legislação em TI', 'SI 4º'))).toEqual({ cedidas: 0, assumidas: 2, saldo: 2 })
  })

  it('CA-07: recusa ou cancelamento não muda as aulas e libera as travas', async () => {
    const amb = await criarAmbiente()
    const antes = amb.aulaEm('SI 4º', '2026-11-26', 1)
    const p1 = (await pedidoAnaBruno(amb)).json()
    expect((await amb.como('Bruno Lima').post(`/pedidos/${p1.id}/recusar`)).json().pedido.status).toBe('recusado')
    expect(amb.aulaEm('SI 4º', '2026-11-26', 1)).toEqual(antes)

    const p2 = (await pedidoAnaBruno(amb)).json()
    expect((await amb.como('Bruno Lima').post(`/pedidos/${p2.id}/cancelar`)).statusCode).toBe(403)
    expect((await amb.como('Ana Souza').post(`/pedidos/${p2.id}/aprovar`)).statusCode).toBe(403)
    expect((await amb.como('Ana Souza').post(`/pedidos/${p2.id}/cancelar`)).json().pedido.status).toBe('cancelado')
    expect(amb.aulaEm('SI 4º', '2026-11-26', 1)).toEqual(antes)
    expect(amb.aulaEm('SI 4º', '2026-11-25', 2).pedidoPendenteId).toBeNull()
    const tipos = ((await amb.como('Ana Souza').get('/historico')).json() as any[]).map((e) => e.tipo)
    expect(tipos).toContain('pedido_recusado')
    expect(tipos).toContain('pedido_cancelado')
  })

  it('CA-10: noite compartilhada assumida por quem só dá aula numa turma deixa a outra vaga', async () => {
    const amb = await criarAmbiente()
    // Hélio (Ética, SI 4º + ADS 4º, segunda) cede a noite a Bruno, que só leciona no SI 4º
    const p = (
      await amb.como('Hélio Martins').post('/pedidos', {
        tipo: 'pontual',
        aulaId: amb.aulaEm('SI 4º', '2026-11-30', 1).id,
        destinatarioId: amb.idPessoa('Bruno Lima'),
        disciplinaDestinoId: amb.idDisciplina('Engenharia de Software'),
      })
    ).json()
    expect(amb.aulaEm('ADS 4º', '2026-11-30', 2).pedidoPendenteId).toBe(p.id)
    expect((await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)).statusCode).toBe(200)
    for (const h of [1, 2]) {
      expect(amb.aulaEm('SI 4º', '2026-11-30', h).disciplinaAtualId).toBe(amb.idDisciplina('Engenharia de Software'))
      expect(amb.aulaEm('ADS 4º', '2026-11-30', h).status).toBe('vaga')
    }
    expect((await amb.saldoDe('Ética e Legislação em TI', 'ADS 4º')).cedidas).toBe(2)
    expect((await amb.saldoDe('Ética e Legislação em TI', 'SI 4º')).cedidas).toBe(2)
    expect((await amb.saldoDe('Engenharia de Software', 'SI 4º')).assumidas).toBe(2)
  })

  it('CA-16: pedido pendente expira quando a noite começa e libera as travas', async () => {
    const amb = await criarAmbiente()
    const p = (await pedidoAnaBruno(amb)).json()
    amb.relogio.atual = new Date('2026-11-25T19:15:00')
    const lista = (await amb.como('Ana Souza').get('/pedidos?caixa=enviados')).json() as any[]
    expect(lista.find((x) => x.id === p.id).status).toBe('expirado')
    expect(amb.aulaEm('SI 4º', '2026-11-26', 1).pedidoPendenteId).toBeNull()
    expect((await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)).statusCode).toBe(409)
  })

  it('RF-11: noite já trocada pode ser trocada de novo (inclusive de volta)', async () => {
    const amb = await criarAmbiente()
    const p = (await pedidoAnaBruno(amb)).json()
    await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)
    const volta = await amb.como('Bruno Lima').post('/pedidos', {
      tipo: 'compensatoria',
      aulaId: amb.aulaEm('SI 4º', '2026-11-26', 1).id,
      destinatarioId: amb.idPessoa('Ana Souza'),
      aulaPedidaId: amb.aulaEm('SI 4º', '2026-11-25', 1).id,
    })
    expect(volta.statusCode).toBe(201)
    await amb.como('Ana Souza').post(`/pedidos/${volta.json().id}/aprovar`)
    expect(amb.aulaEm('SI 4º', '2026-11-26', 2).disciplinaAtualId).toBe(amb.idDisciplina('Banco de Dados II'))
    expect(saldo(await amb.saldoDe('Banco de Dados II', 'SI 4º'))).toEqual({ cedidas: 0, assumidas: 0, saldo: 0 })
  })
})
