import { describe, expect, it } from 'vitest'
import { criarAmbiente, pedidoAnaBruno } from './ambiente.js'

describe('Resposta a pedidos', () => {
  it('CA-05: aprovação da compensatória troca as aulas, libera travas, registra histórico e zera o saldo', async () => {
    const amb = await criarAmbiente()
    const p = (await pedidoAnaBruno(amb)).json()
    const r = await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)
    expect(r.statusCode).toBe(200)

    const quinta = amb.aulaEm('SI 4º', '2026-11-19', 1)
    const quarta = amb.aulaEm('SI 4º', '2026-11-18', 1)
    expect(quinta.disciplinaAtualId).toBe(amb.idDisciplina('Engenharia de Software'))
    expect(quinta.professorAtualId).toBe(amb.idPessoa('Bruno Lima'))
    expect(quarta.disciplinaAtualId).toBe(amb.idDisciplina('Banco de Dados II'))
    expect(quarta.professorAtualId).toBe(amb.idPessoa('Ana Souza'))
    expect(quinta.pedidoPendenteId).toBeNull()
    expect(quarta.pedidoPendenteId).toBeNull()

    const historico = (await amb.como('Ana Souza').get('/historico')).json() as any[]
    expect(historico.some((e) => e.tipo === 'pedido_aprovado' && e.pedidoId === p.id)).toBe(true)

    const bd = await amb.saldoDe('Banco de Dados II', 'SI 4º')
    const es = await amb.saldoDe('Engenharia de Software', 'SI 4º')
    expect([bd.cedidas, bd.assumidas, bd.saldo]).toEqual([1, 1, 0])
    expect([es.cedidas, es.assumidas, es.saldo]).toEqual([1, 1, 0])
  })

  it('CA-06: troca pontual aprovada deixa −1 para quem cedeu e +1 para quem assumiu', async () => {
    const amb = await criarAmbiente()
    const p = (
      await amb.como('Ana Souza').post('/pedidos', {
        tipo: 'pontual',
        aulaId: amb.aulaEm('SI 4º', '2026-11-26', 1).id,
        destinatarioId: amb.idPessoa('Bruno Lima'),
        disciplinaDestinoId: amb.idDisciplina('Engenharia de Software'),
      })
    ).json()
    expect((await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)).statusCode).toBe(200)
    const bd = await amb.saldoDe('Banco de Dados II', 'SI 4º')
    const es = await amb.saldoDe('Engenharia de Software', 'SI 4º')
    expect([bd.cedidas, bd.saldo, bd.situacao]).toEqual([1, -1, 'a repor'])
    expect([es.assumidas, es.saldo, es.situacao]).toEqual([1, 1, 'crédito'])
  })

  it('CA-07: recusa ou cancelamento não muda as aulas e libera as travas', async () => {
    const amb = await criarAmbiente()
    const antes = amb.aulaEm('SI 4º', '2026-11-19', 1)

    const p1 = (await pedidoAnaBruno(amb)).json()
    expect((await amb.como('Bruno Lima').post(`/pedidos/${p1.id}/recusar`)).json().pedido.status).toBe('recusado')
    expect(amb.aulaEm('SI 4º', '2026-11-19', 1)).toEqual(antes)

    const p2 = (await pedidoAnaBruno(amb)).json()
    // Só quem pediu pode cancelar; só o destinatário pode aprovar
    expect((await amb.como('Bruno Lima').post(`/pedidos/${p2.id}/cancelar`)).statusCode).toBe(403)
    expect((await amb.como('Ana Souza').post(`/pedidos/${p2.id}/aprovar`)).statusCode).toBe(403)
    expect((await amb.como('Ana Souza').post(`/pedidos/${p2.id}/cancelar`)).json().pedido.status).toBe('cancelado')
    expect(amb.aulaEm('SI 4º', '2026-11-19', 1)).toEqual(antes)
    expect(amb.aulaEm('SI 4º', '2026-11-18', 1).pedidoPendenteId).toBeNull()

    const tipos = ((await amb.como('Ana Souza').get('/historico')).json() as any[]).map((e) => e.tipo)
    expect(tipos).toContain('pedido_recusado')
    expect(tipos).toContain('pedido_cancelado')
  })

  it('CA-10: aula compartilhada assumida por quem só dá aula numa turma deixa a outra vaga', async () => {
    const amb = await criarAmbiente()
    // Hélio (Ética, SI 4º + ADS 4º, sexta 1º horário) cede a Fernanda, que só leciona no SI 4º
    const p = (
      await amb.como('Hélio Martins').post('/pedidos', {
        tipo: 'pontual',
        aulaId: amb.aulaEm('SI 4º', '2026-11-27', 1).id,
        destinatarioId: amb.idPessoa('Fernanda Dias'),
        disciplinaDestinoId: amb.idDisciplina('Redes de Computadores'),
      })
    ).json()
    // As duas turmas do grupo ficam travadas
    expect(amb.aulaEm('ADS 4º', '2026-11-27', 1).pedidoPendenteId).toBe(p.id)
    expect((await amb.como('Fernanda Dias').post(`/pedidos/${p.id}/aprovar`)).statusCode).toBe(200)

    const si = amb.aulaEm('SI 4º', '2026-11-27', 1)
    const ads = amb.aulaEm('ADS 4º', '2026-11-27', 1)
    expect(si.disciplinaAtualId).toBe(amb.idDisciplina('Redes de Computadores'))
    expect(ads.status).toBe('vaga')
    expect(ads.disciplinaAtualId).toBeNull()

    expect((await amb.saldoDe('Ética e Legislação em TI', 'ADS 4º')).cedidas).toBe(1)
    expect((await amb.saldoDe('Ética e Legislação em TI', 'SI 4º')).cedidas).toBe(1)
    expect((await amb.saldoDe('Redes de Computadores', 'SI 4º')).assumidas).toBe(1)
  })

  it('CA-16: pedido pendente expira quando a aula começa e libera as travas', async () => {
    const amb = await criarAmbiente()
    const p = (await pedidoAnaBruno(amb)).json()
    amb.relogio.atual = new Date('2026-11-18T19:15:00') // começou a aula de quarta
    const lista = (await amb.como('Ana Souza').get('/pedidos?caixa=enviados')).json() as any[]
    expect(lista.find((x) => x.id === p.id).status).toBe('expirado')
    expect(amb.aulaEm('SI 4º', '2026-11-19', 1).pedidoPendenteId).toBeNull()
    expect((await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)).statusCode).toBe(409)
  })

  it('RF-11: aula já trocada pode ser trocada de novo (inclusive de volta)', async () => {
    const amb = await criarAmbiente()
    const p = (await pedidoAnaBruno(amb)).json()
    await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)
    // Agora Bruno é o professor da quinta e Ana da quarta: desfazem com uma nova troca
    const volta = await amb.como('Bruno Lima').post('/pedidos', {
      tipo: 'compensatoria',
      aulaId: amb.aulaEm('SI 4º', '2026-11-19', 1).id,
      destinatarioId: amb.idPessoa('Ana Souza'),
      aulaPedidaId: amb.aulaEm('SI 4º', '2026-11-18', 1).id,
    })
    expect(volta.statusCode).toBe(201)
    await amb.como('Ana Souza').post(`/pedidos/${volta.json().id}/aprovar`)
    expect(amb.aulaEm('SI 4º', '2026-11-19', 1).disciplinaAtualId).toBe(amb.idDisciplina('Banco de Dados II'))
    const bd = await amb.saldoDe('Banco de Dados II', 'SI 4º')
    expect([bd.cedidas, bd.assumidas, bd.saldo]).toEqual([0, 0, 0])
  })
})
