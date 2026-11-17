import { describe, expect, it } from 'vitest'
import { criarAmbiente, pedidoAnaBruno } from './ambiente.js'

describe('Criação de pedidos', () => {
  it('CA-03: troca compensatória fica pendente e trava as aulas dos dois professores', async () => {
    const amb = await criarAmbiente()
    const r = await pedidoAnaBruno(amb)
    expect(r.statusCode).toBe(201)
    expect(r.json().status).toBe('pendente')
    expect(amb.aulaEm('SI 4º', '2026-11-19', 1).pedidoPendenteId).toBe(r.json().id)
    expect(amb.aulaEm('SI 4º', '2026-11-18', 1).pedidoPendenteId).toBe(r.json().id)
    // As outras aulas continuam livres
    expect(amb.aulaEm('SI 4º', '2026-11-19', 2).pedidoPendenteId).toBeNull()
  })

  it('CA-04: aula travada não pode entrar em outro pedido', async () => {
    const amb = await criarAmbiente()
    await pedidoAnaBruno(amb)
    // Fernanda tenta pedir a aula de quarta do Bruno, que está travada
    const r = await amb.como('Fernanda Dias').post('/pedidos', {
      tipo: 'compensatoria',
      aulaId: amb.aulaEm('SI 4º', '2026-11-23', 1).id,
      destinatarioId: amb.idPessoa('Bruno Lima'),
      aulaPedidaId: amb.aulaEm('SI 4º', '2026-11-18', 1).id,
    })
    expect(r.statusCode).toBe(409)
    expect(r.json().erro).toMatch(/travada/)
    // E Ana não consegue cancelar a aula travada
    const c = await amb.como('Ana Souza').post(`/aulas/${amb.aulaEm('SI 4º', '2026-11-19', 1).id}/cancelar`, { motivo: 'teste' })
    expect(c.statusCode).toBe(409)
  })

  it('CA-08: lista só colegas das turmas da aula e indica quem está livre', async () => {
    const amb = await criarAmbiente()
    const r = await amb.como('Ana Souza').get(`/aulas/${amb.aulaEm('SI 4º', '2026-11-19', 1).id}/candidatos`)
    const lista = r.json() as any[]
    const nomes = lista.map((c) => c.nome).sort()
    // Professores com disciplina no SI 4º (exceto a própria Ana)
    expect(nomes).toEqual(['Bruno Lima', 'Carla Mendes', 'Fernanda Dias', 'Hélio Martins'])
    // Carla dá Sistemas Operacionais no ADS 2º às quintas: ocupada
    expect(lista.find((c) => c.nome === 'Carla Mendes').disponivel).toBe(false)
    expect(lista.find((c) => c.nome === 'Bruno Lima').disponivel).toBe(true)
  })

  it('CA-09: troca que geraria choque de horário é recusada', async () => {
    const amb = await criarAmbiente()
    // Carla está ocupada na quinta (ADS 2º): não pode assumir a aula de Ana
    const r = await amb.como('Ana Souza').post('/pedidos', {
      tipo: 'pontual',
      aulaId: amb.aulaEm('SI 4º', '2026-11-19', 1).id,
      destinatarioId: amb.idPessoa('Carla Mendes'),
      disciplinaDestinoId: amb.idDisciplina('Programação Web'),
    })
    expect(r.statusCode).toBe(409)
    expect(r.json().erro).toMatch(/Choque de horário/)
  })

  it('CA-09: compensatória que deixaria o solicitante em duas aulas ao mesmo tempo é recusada', async () => {
    const amb = await criarAmbiente()
    // Ana pede a aula de Carla (Programação Web, SI 4º, terça 1º horário),
    // mas nesse horário Ana já dá Banco de Dados no ADS 4º.
    const r = await amb.como('Ana Souza').post('/pedidos', {
      tipo: 'compensatoria',
      aulaId: amb.aulaEm('SI 4º', '2026-11-26', 1).id,
      destinatarioId: amb.idPessoa('Carla Mendes'),
      aulaPedidaId: amb.aulaEm('SI 4º', '2026-11-24', 1).id,
    })
    expect(r.statusCode).toBe(409)
    expect(r.json().erro).toMatch(/Choque de horário/)
  })

  it('CA-15: aula que já começou não pode ser trocada nem cancelada', async () => {
    const amb = await criarAmbiente('2026-11-19T19:30:00') // quinta, durante o 1º horário
    const r = await pedidoAnaBruno(amb)
    expect(r.statusCode).toBe(409)
    expect(r.json().erro).toMatch(/já começou/)
    const c = await amb.como('Ana Souza').post(`/aulas/${amb.aulaEm('SI 4º', '2026-11-19', 1).id}/cancelar`, { motivo: 'teste' })
    expect(c.statusCode).toBe(409)
  })

  it('RN-08: só o professor da aula pode oferecê-la', async () => {
    const amb = await criarAmbiente()
    const r = await amb.como('Bruno Lima').post('/pedidos', {
      tipo: 'pontual',
      aulaId: amb.aulaEm('SI 4º', '2026-11-19', 1).id,
      destinatarioId: amb.idPessoa('Fernanda Dias'),
      disciplinaDestinoId: amb.idDisciplina('Redes de Computadores'),
    })
    expect(r.statusCode).toBe(403)
  })

  it('RN-01: troca só entre professores da mesma turma', async () => {
    const amb = await criarAmbiente()
    const r = await amb.como('Ana Souza').post('/pedidos', {
      tipo: 'pontual',
      aulaId: amb.aulaEm('SI 4º', '2026-11-19', 1).id,
      destinatarioId: amb.idPessoa('Rafael Nunes'),
      disciplinaDestinoId: amb.idDisciplina('Sistemas Distribuídos'),
    })
    expect(r.statusCode).toBe(400)
    expect(r.json().erro).toMatch(/mesma turma/)
  })
})
