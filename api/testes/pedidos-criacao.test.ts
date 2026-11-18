import { describe, expect, it } from 'vitest'
import { criarAmbiente, pedidoAnaBruno } from './ambiente.js'

describe('Criação de pedidos', () => {
  it('CA-03: troca compensatória fica pendente e trava as duas noites (4 aulas)', async () => {
    const amb = await criarAmbiente()
    const r = await pedidoAnaBruno(amb)
    expect(r.statusCode).toBe(201)
    expect(r.json().status).toBe('pendente')
    for (const data of ['2026-11-26', '2026-11-25'])
      for (const h of [1, 2]) expect(amb.aulaEm('SI 4º', data, h).pedidoPendenteId).toBe(r.json().id)
    expect(amb.aulaEm('SI 4º', '2026-11-24', 1).pedidoPendenteId).toBeNull()
  })

  it('CA-04: noite travada não pode entrar em outro pedido nem ser cancelada', async () => {
    const amb = await criarAmbiente()
    await pedidoAnaBruno(amb)
    const r = await amb.como('Carla Mendes').post('/pedidos', {
      tipo: 'compensatoria',
      aulaId: amb.aulaEm('SI 4º', '2026-11-24', 1).id,
      destinatarioId: amb.idPessoa('Bruno Lima'),
      aulaPedidaId: amb.aulaEm('SI 4º', '2026-11-25', 2).id,
    })
    expect(r.statusCode).toBe(409)
    expect(r.json().erro).toMatch(/travada/)
    const c = await amb.como('Ana Souza').post(`/aulas/${amb.aulaEm('SI 4º', '2026-11-26', 2).id}/cancelar`, { motivo: 'teste' })
    expect(c.statusCode).toBe(409)
  })

  it('CA-08: lista só colegas das turmas da aula e indica quem está livre a noite toda', async () => {
    const amb = await criarAmbiente()
    const lista = (await amb.como('Ana Souza').get(`/aulas/${amb.aulaEm('SI 4º', '2026-11-26', 1).id}/candidatos`)).json() as any[]
    expect(lista.map((c) => c.nome).sort()).toEqual(['Bruno Lima', 'Carla Mendes', 'Hélio Martins'])
    // Carla dá Sistemas Operacionais no ADS 2º às quintas: ocupada
    expect(lista.find((c) => c.nome === 'Carla Mendes').disponivel).toBe(false)
    expect(lista.find((c) => c.nome === 'Bruno Lima').disponivel).toBe(true)
  })

  it('CA-09: troca que geraria choque de horário é recusada', async () => {
    const amb = await criarAmbiente()
    const r = await amb.como('Ana Souza').post('/pedidos', {
      tipo: 'pontual',
      aulaId: amb.aulaEm('SI 4º', '2026-11-26', 1).id,
      destinatarioId: amb.idPessoa('Carla Mendes'),
      disciplinaDestinoId: amb.idDisciplina('Programação Web'),
    })
    expect(r.statusCode).toBe(409)
    expect(r.json().erro).toMatch(/Choque de horário/)
  })

  it('CA-09: compensatória que deixaria o solicitante em duas aulas ao mesmo tempo é recusada', async () => {
    const amb = await criarAmbiente()
    // Ana pede a terça de Carla no SI 4º, mas às terças Ana dá Banco de Dados no ADS 4º
    const r = await amb.como('Ana Souza').post('/pedidos', {
      tipo: 'compensatoria',
      aulaId: amb.aulaEm('SI 4º', '2026-11-26', 1).id,
      destinatarioId: amb.idPessoa('Carla Mendes'),
      aulaPedidaId: amb.aulaEm('SI 4º', '2026-11-24', 1).id,
    })
    expect(r.statusCode).toBe(409)
    expect(r.json().erro).toMatch(/Choque de horário/)
  })

  it('CA-15: noite que já começou não pode ser trocada nem cancelada', async () => {
    const amb = await criarAmbiente('2026-11-26T19:30:00')
    const r = await amb.como('Ana Souza').post('/pedidos', {
      tipo: 'pontual',
      aulaId: amb.aulaEm('SI 4º', '2026-11-26', 2).id,
      destinatarioId: amb.idPessoa('Bruno Lima'),
      disciplinaDestinoId: amb.idDisciplina('Engenharia de Software'),
    })
    expect(r.statusCode).toBe(409)
    expect(r.json().erro).toMatch(/já começou/)
    const c = await amb.como('Ana Souza').post(`/aulas/${amb.aulaEm('SI 4º', '2026-11-26', 2).id}/cancelar`, { motivo: 'teste' })
    expect(c.statusCode).toBe(409)
  })

  it('CA-22: escolher só o 2º horário trava e troca a noite inteira', async () => {
    const amb = await criarAmbiente()
    const r = await amb.como('Ana Souza').post('/pedidos', {
      tipo: 'pontual',
      aulaId: amb.aulaEm('SI 4º', '2026-11-26', 2).id,
      destinatarioId: amb.idPessoa('Bruno Lima'),
      disciplinaDestinoId: amb.idDisciplina('Engenharia de Software'),
    })
    expect(r.statusCode).toBe(201)
    expect(amb.aulaEm('SI 4º', '2026-11-26', 1).pedidoPendenteId).toBe(r.json().id)
    expect(amb.aulaEm('SI 4º', '2026-11-26', 2).pedidoPendenteId).toBe(r.json().id)
  })

  it('RN-08: só o professor da aula pode oferecê-la', async () => {
    const amb = await criarAmbiente()
    const r = await amb.como('Bruno Lima').post('/pedidos', {
      tipo: 'pontual',
      aulaId: amb.aulaEm('SI 4º', '2026-11-26', 1).id,
      destinatarioId: amb.idPessoa('Carla Mendes'),
      disciplinaDestinoId: amb.idDisciplina('Programação Web'),
    })
    expect(r.statusCode).toBe(403)
  })

  it('RN-01: troca só entre professores da mesma turma', async () => {
    const amb = await criarAmbiente()
    const r = await amb.como('Ana Souza').post('/pedidos', {
      tipo: 'pontual',
      aulaId: amb.aulaEm('SI 4º', '2026-11-26', 1).id,
      destinatarioId: amb.idPessoa('Rafael Nunes'),
      disciplinaDestinoId: amb.idDisciplina('Sistemas Distribuídos'),
    })
    expect(r.statusCode).toBe(400)
    expect(r.json().erro).toMatch(/mesma turma/)
  })
})
