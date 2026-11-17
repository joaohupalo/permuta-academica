import { describe, expect, it } from 'vitest'
import { criarAmbiente } from './ambiente.js'

describe('Cadastros e CSV', () => {
  it('CA-19: importação de professores mostra prévia, aponta linhas inválidas e só grava ao confirmar', async () => {
    const amb = await criarAmbiente()
    const admin = amb.como('coordenacao')
    const linhas = [
      { nome: 'Paula Freitas', email: 'paula.freitas@unimater.edu' },
      { nome: '', email: 'sem.nome@unimater.edu' },
      { nome: 'Email Ruim', email: 'nao-e-email' },
      { nome: 'Ana Duplicada', email: 'ana.souza@unimater.edu' },
    ]
    const previa = (await admin.post('/importar/professores?simular=true', { linhas })).json()
    expect(previa.validas).toBe(1)
    expect(previa.erros.map((e: any) => e.linha)).toEqual([3, 4, 5])
    expect((await admin.get('/professores')).json().some((p: any) => p.nome === 'Paula Freitas')).toBe(false)

    const r = (await admin.post('/importar/professores', { linhas })).json()
    expect(r.criados).toBe(1)
    expect((await admin.get('/professores')).json().some((p: any) => p.nome === 'Paula Freitas')).toBe(true)
  })

  it('CA-19: importação de feriados aceita DD/MM/AAAA e marca as aulas do dia', async () => {
    const amb = await criarAmbiente()
    const r = (await amb.como('coordenacao').post('/importar/feriados', { linhas: [{ data: '08/12/2026', descricao: 'Imaculada Conceição' }] })).json()
    expect(r.criados).toBe(1)
    expect(amb.aulaEm('SI 4º', '2026-12-08', 1).status).toBe('feriado')
  })

  it('CA-19: importação de turmas valida o curso', async () => {
    const amb = await criarAmbiente()
    const r = (await amb.como('coordenacao').post('/importar/turmas?simular=true', { linhas: [{ nome: 'SI 10º', curso: 'si' }, { nome: 'CC 1º', curso: 'CC' }] })).json()
    expect(r.validas).toBe(1)
    expect(r.erros[0].linha).toBe(3)
  })

  it('RF-01: disciplina com choque na grade fixa é recusada', async () => {
    const amb = await criarAmbiente()
    const r = await amb.como('coordenacao').post('/disciplinas', {
      nome: 'Nova',
      professorId: amb.idPessoa('Rafael Nunes'),
      totalAulas: 20,
      turmaIds: [amb.idTurma('SI 4º')],
      horarios: [{ diaSemana: 4, horario: 1, sala: '' }], // quinta 1º: SI 4º já tem Banco de Dados II
    })
    expect(r.statusCode).toBe(409)
  })
})
