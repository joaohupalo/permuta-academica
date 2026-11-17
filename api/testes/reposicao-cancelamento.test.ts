import { describe, expect, it } from 'vitest'
import { criarAmbiente } from './ambiente.js'

describe('Reposição e cancelamento', () => {
  it('CA-11: reposição em horário vazio cria a aula, sem aprovação, e conta como assumida', async () => {
    const amb = await criarAmbiente()
    // SI 4º não tem aula na sexta, 2º horário
    expect(amb.aulasEm('SI 4º', '2026-11-27', 2)).toHaveLength(0)
    const r = await amb.como('Ana Souza').post('/reposicoes', {
      disciplinaId: amb.idDisciplina('Banco de Dados II'),
      turmaId: amb.idTurma('SI 4º'),
      data: '2026-11-27',
      horario: 2,
    })
    expect(r.statusCode).toBe(201)
    const nova = amb.aulaEm('SI 4º', '2026-11-27', 2)
    expect(nova.disciplinaPrevistaId).toBeNull()
    expect(nova.disciplinaAtualId).toBe(amb.idDisciplina('Banco de Dados II'))
    expect((await amb.saldoDe('Banco de Dados II', 'SI 4º')).assumidas).toBe(1)
  })

  it('CA-11: quem cedeu e repõe volta a zero', async () => {
    const amb = await criarAmbiente()
    const p = (
      await amb.como('Ana Souza').post('/pedidos', {
        tipo: 'pontual',
        aulaId: amb.aulaEm('SI 4º', '2026-11-26', 1).id,
        destinatarioId: amb.idPessoa('Bruno Lima'),
        disciplinaDestinoId: amb.idDisciplina('Engenharia de Software'),
      })
    ).json()
    await amb.como('Bruno Lima').post(`/pedidos/${p.id}/aprovar`)
    expect((await amb.saldoDe('Banco de Dados II', 'SI 4º')).saldo).toBe(-1)
    await amb.como('Ana Souza').post('/reposicoes', { disciplinaId: amb.idDisciplina('Banco de Dados II'), turmaId: amb.idTurma('SI 4º'), data: '2026-12-04', horario: 2 })
    expect((await amb.saldoDe('Banco de Dados II', 'SI 4º')).saldo).toBe(0)
  })

  it('CA-12: reposição recusada em horário ocupado, em feriado ou com choque', async () => {
    const amb = await criarAmbiente()
    const repor = (data: string, horario: number) =>
      amb.como('Ana Souza').post('/reposicoes', { disciplinaId: amb.idDisciplina('Banco de Dados II'), turmaId: amb.idTurma('SI 4º'), data, horario })
    expect((await repor('2026-11-23', 1)).statusCode).toBe(409) // ocupado (Redes)
    expect((await repor('2026-11-20', 2)).statusCode).toBe(409) // feriado
    // Choque: SI 4º está vago na sexta 2º horário, mas Bruno dá Testes no ADS 4º nesse horário
    const choque = await amb.como('Bruno Lima').post('/reposicoes', {
      disciplinaId: amb.idDisciplina('Engenharia de Software'),
      turmaId: amb.idTurma('SI 4º'),
      data: '2026-11-27',
      horario: 2,
    })
    expect(choque.statusCode).toBe(409)
    expect(choque.json().erro).toMatch(/Choque de horário/)
    // Vaga no SI 4º sexta 2º horário, mas quem não é professor da disciplina não pode repor por ela
    const r = await amb.como('Bruno Lima').post('/reposicoes', { disciplinaId: amb.idDisciplina('Banco de Dados II'), turmaId: amb.idTurma('SI 4º'), data: '2026-11-27', horario: 2 })
    expect(r.statusCode).toBe(403)
  })

  it('CA-13: cancelamento exige motivo e vira débito', async () => {
    const amb = await criarAmbiente()
    const id = amb.aulaEm('SI 4º', '2026-11-19', 1).id
    expect((await amb.como('Ana Souza').post(`/aulas/${id}/cancelar`, { motivo: '' })).statusCode).toBe(400)
    const r = await amb.como('Ana Souza').post(`/aulas/${id}/cancelar`, { motivo: 'Consulta médica' })
    expect(r.statusCode).toBe(200)
    const a = amb.aulasEm('SI 4º', '2026-11-19', 1)[0]
    expect(a.status).toBe('cancelada')
    expect(a.motivo).toBe('Consulta médica')
    const s = await amb.saldoDe('Banco de Dados II', 'SI 4º')
    expect([s.canceladas, s.saldo]).toEqual([1, -1])
  })

  it('CA-21: horário de aula cancelada aceita reposição de outro professor', async () => {
    const amb = await criarAmbiente()
    const id = amb.aulaEm('SI 4º', '2026-11-19', 1).id
    await amb.como('Ana Souza').post(`/aulas/${id}/cancelar`, { motivo: 'Consulta médica' })

    const vagos = (await amb.como('Bruno Lima').get(`/horarios-vagos?disciplinaId=${amb.idDisciplina('Engenharia de Software')}`)).json() as any[]
    expect(vagos.some((v) => v.data === '2026-11-19' && v.horario === 1)).toBe(true)

    const r = await amb.como('Bruno Lima').post('/reposicoes', {
      disciplinaId: amb.idDisciplina('Engenharia de Software'),
      turmaId: amb.idTurma('SI 4º'),
      data: '2026-11-19',
      horario: 1,
    })
    expect(r.statusCode).toBe(201)
    expect(r.json().informativo[0]).toMatch(/Banco de Dados II — Ana Souza \(cancelada\)/)

    const noHorario = amb.aulasEm('SI 4º', '2026-11-19', 1)
    expect(noHorario.map((a) => a.status).sort()).toEqual(['cancelada', 'normal'])
    expect((await amb.saldoDe('Banco de Dados II', 'SI 4º')).canceladas).toBe(1)
    expect((await amb.saldoDe('Engenharia de Software', 'SI 4º')).assumidas).toBe(1)

    const painel = (await amb.app.inject({ url: '/api/painel?data=2026-11-19' })).json()
    const naTV = painel.aulas.filter((a: any) => a.turmaId === amb.idTurma('SI 4º') && a.data === '2026-11-19' && a.horario === 1)
    expect(naTV).toHaveLength(1)
    expect(naTV[0]).toMatchObject({ tipo: 'reposicao', disciplina: 'Engenharia de Software', previsto: { disciplina: 'Banco de Dados II (cancelada)' } })
  })
})
