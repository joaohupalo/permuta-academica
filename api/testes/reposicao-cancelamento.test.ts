import { describe, expect, it } from 'vitest'
import { criarAmbiente, pontualAnaBruno } from './ambiente.js'

describe('Reposição e cancelamento', () => {
  it('CA-11: reposição em noite vaga ocupa os dois horários, sem aprovação, e conta 2 assumidas', async () => {
    const amb = await criarAmbiente()
    const p = (await pontualAnaBruno(amb)).json()
    await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`) // Ana passa a dever 2
    expect(amb.aulasEm('SI 4º', '2026-11-27', 1)).toHaveLength(0)
    const r = await amb.como('Ana Souza').post('/reposicoes', { disciplinaId: amb.idDisciplina('Banco de Dados II'), turmaId: amb.idTurma('SI 4º'), data: '2026-11-27' })
    expect(r.statusCode).toBe(201)
    for (const h of [1, 2]) {
      const nova = amb.aulaEm('SI 4º', '2026-11-27', h)
      expect(nova.disciplinaAtualId).toBe(amb.idDisciplina('Banco de Dados II'))
      expect(nova.disciplinaPrevistaId).toBeNull()
    }
    const s = await amb.saldoDe('Banco de Dados II', 'SI 4º')
    expect([s.cedidas, s.assumidas, s.saldo]).toEqual([2, 2, 0])
  })

  it('CA-11: quem cedeu uma noite e repõe outra volta a zero', async () => {
    const amb = await criarAmbiente()
    const p = (await pontualAnaBruno(amb)).json()
    await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)
    expect((await amb.saldoDe('Banco de Dados II', 'SI 4º')).saldo).toBe(-2)
    await amb.como('Ana Souza').post('/reposicoes', { disciplinaId: amb.idDisciplina('Banco de Dados II'), turmaId: amb.idTurma('SI 4º'), data: '2026-12-04' })
    expect((await amb.saldoDe('Banco de Dados II', 'SI 4º')).saldo).toBe(0)
  })

  it('CA-12: reposição recusada em noite ocupada, em feriado ou com choque', async () => {
    const amb = await criarAmbiente()
    await amb.como('Ana Souza').post(`/aulas/${amb.aulaEm('SI 4º', '2026-11-26', 1).id}/cancelar`, { motivo: 'Consulta' }) // Ana passa a dever 2
    const repor = (data: string) => amb.como('Ana Souza').post('/reposicoes', { disciplinaId: amb.idDisciplina('Banco de Dados II'), turmaId: amb.idTurma('SI 4º'), data })
    expect((await repor('2026-11-23')).statusCode).toBe(409) // ocupada (Ética)
    expect((await repor('2026-11-20')).statusCode).toBe(409) // feriado
    // Choque: SI 4º está vago na sexta, mas Hélio dá Programação Mobile no ADS 4º às sextas
    const choque = await amb.como('Hélio Martins').post('/reposicoes', { disciplinaId: amb.idDisciplina('Ética e Legislação em TI'), turmaId: amb.idTurma('SI 4º'), data: '2026-11-27' })
    expect(choque.statusCode).toBe(409)
    expect(choque.json().erro).toMatch(/Choque de horário/)
    const r = await amb.como('Bruno Lima').post('/reposicoes', { disciplinaId: amb.idDisciplina('Banco de Dados II'), turmaId: amb.idTurma('SI 4º'), data: '2026-11-27' })
    expect(r.statusCode).toBe(403)
  })

  it('CA-13: cancelamento exige motivo e debita a noite inteira (2 aulas)', async () => {
    const amb = await criarAmbiente()
    const id = amb.aulaEm('SI 4º', '2026-11-26', 1).id
    expect((await amb.como('Ana Souza').post(`/aulas/${id}/cancelar`, { motivo: '' })).statusCode).toBe(400)
    expect((await amb.como('Ana Souza').post(`/aulas/${id}/cancelar`, { motivo: 'Consulta médica' })).statusCode).toBe(200)
    for (const h of [1, 2]) {
      const a = amb.aulasEm('SI 4º', '2026-11-26', h)[0]
      expect([a.status, a.motivo]).toEqual(['cancelada', 'Consulta médica'])
    }
    const s = await amb.saldoDe('Banco de Dados II', 'SI 4º')
    expect([s.canceladas, s.saldo]).toEqual([2, -2])
  })

  it('CA-21: noite de aula cancelada aceita reposição de outro professor', async () => {
    const amb = await criarAmbiente()
    await amb.como('Ana Souza').post(`/aulas/${amb.aulaEm('SI 4º', '2026-11-26', 1).id}/cancelar`, { motivo: 'Consulta médica' })
    const vagas = (await amb.como('Bruno Lima').get(`/noites-vagas?disciplinaId=${amb.idDisciplina('Engenharia de Software')}`)).json() as any[]
    expect(vagas.some((v) => v.data === '2026-11-26')).toBe(true)

    const r = await amb.como('Bruno Lima').post('/reposicoes', { disciplinaId: amb.idDisciplina('Engenharia de Software'), turmaId: amb.idTurma('SI 4º'), data: '2026-11-26' })
    expect(r.statusCode).toBe(201)
    expect(r.json().informativo[0]).toMatch(/Banco de Dados II — Ana Souza \(cancelada\)/)
    for (const h of [1, 2]) expect(amb.aulasEm('SI 4º', '2026-11-26', h).map((a) => a.status).sort()).toEqual(['cancelada', 'normal'])
    expect((await amb.saldoDe('Banco de Dados II', 'SI 4º')).canceladas).toBe(2)
    expect((await amb.saldoDe('Engenharia de Software', 'SI 4º')).assumidas).toBe(2)

    const painel = (await amb.app.inject({ url: '/api/painel?data=2026-11-26' })).json()
    const naTV = painel.aulas.filter((a: any) => a.turmaId === amb.idTurma('SI 4º') && a.data === '2026-11-26')
    expect(naTV).toHaveLength(2)
    expect(naTV.every((a: any) => a.tipo === 'reposicao' && a.previsto.disciplina === 'Banco de Dados II (cancelada)')).toBe(true)
  })
})

describe('Acerto de contas', () => {
  it('CA-23: assumida e depois cancelada não conta para quem assumiu; quem cedeu continua devendo', async () => {
    const amb = await criarAmbiente()
    const p = (await pontualAnaBruno(amb)).json()
    await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)
    expect((await amb.como('Bruno Lima').post(`/aulas/${amb.aulaEm('SI 4º', '2026-11-26', 1).id}/cancelar`, { motivo: 'Imprevisto' })).statusCode).toBe(200)
    const es = await amb.saldoDe('Engenharia de Software', 'SI 4º')
    expect([es.assumidas, es.canceladas, es.saldo]).toEqual([0, 0, 0])
    const bd = await amb.saldoDe('Banco de Dados II', 'SI 4º')
    expect([bd.cedidas, bd.saldo]).toEqual([2, -2])
    const acertos = (await amb.como('Ana Souza').get('/acertos')).json() as any[]
    expect(acertos).toContainEqual(expect.objectContaining({ turma: 'SI 4º', aulas: 2, acao: 'repor', credor: null, devedor: expect.objectContaining({ professor: 'Ana Souza' }) }))
  })

  it('CA-24: o acerto mostra quem deve a quem e some depois que o credor cede uma noite ao devedor', async () => {
    const amb = await criarAmbiente()
    const p = (await pontualAnaBruno(amb)).json()
    await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)
    let acertos = ((await amb.como('Ana Souza').get('/acertos')).json() as any[]).filter((a) => a.turma === 'SI 4º')
    expect(acertos).toEqual([
      expect.objectContaining({ aulas: 2, acao: 'ceder', devedor: expect.objectContaining({ professor: 'Ana Souza' }), credor: expect.objectContaining({ professor: 'Bruno Lima' }) }),
    ])
    // Bruno quita: cede a noite de quarta 02/12 para a Ana
    const q = (
      await amb.como('Bruno Lima').post('/pedidos', {
        tipo: 'pontual',
        aulaId: amb.aulaEm('SI 4º', '2026-12-02', 1).id,
        destinatarioId: amb.idPessoa('Ana Souza'),
        disciplinaDestinoId: amb.idDisciplina('Banco de Dados II'),
      })
    ).json()
    await amb.como('Ana Souza').post(`/pedidos/${q.id}/aprovar`)
    expect((await amb.saldoDe('Banco de Dados II', 'SI 4º')).saldo).toBe(0)
    expect((await amb.saldoDe('Engenharia de Software', 'SI 4º')).saldo).toBe(0)
    acertos = ((await amb.como('Ana Souza').get('/acertos')).json() as any[]).filter((a) => a.turma === 'SI 4º')
    expect(acertos).toEqual([])
  })

  it('CA-25: sem débito, não há reposição em noite totalmente vazia; noite cancelada de colega continua disponível', async () => {
    const amb = await criarAmbiente()
    const corpo = { disciplinaId: amb.idDisciplina('Banco de Dados II'), turmaId: amb.idTurma('SI 4º'), data: '2026-11-27' }
    const r = await amb.como('Ana Souza').post('/reposicoes', corpo)
    expect(r.statusCode).toBe(409)
    expect(r.json().erro).toMatch(/não tem aulas a repor/)
    const vagas = (await amb.como('Ana Souza').get(`/noites-vagas?disciplinaId=${amb.idDisciplina('Banco de Dados II')}`)).json() as any[]
    expect(vagas.some((v) => v.data === '2026-11-27')).toBe(false)
    // Uma noite cancelada pelo Bruno aparece para a Ana mesmo sem débito
    await amb.como('Bruno Lima').post(`/aulas/${amb.aulaEm('SI 4º', '2026-11-25', 1).id}/cancelar`, { motivo: 'Congresso' })
    const vagas2 = (await amb.como('Ana Souza').get(`/noites-vagas?disciplinaId=${amb.idDisciplina('Banco de Dados II')}`)).json() as any[]
    expect(vagas2.some((v) => v.data === '2026-11-25')).toBe(true)
  })
})
