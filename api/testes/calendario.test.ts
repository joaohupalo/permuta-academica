import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { aula, feriado, horarioFixo, disciplinaTurma } from '../src/db/schema.js'
import { datasEntre, diaDaSemana } from '../src/compartilhado/horarios.js'
import { criarAmbiente } from './ambiente.js'

describe('Calendário', () => {
  it('CA-01: gera uma aula por turma, data e horário fixo, marcando feriados', async () => {
    const amb = await criarAmbiente()
    const { db } = amb
    const horarios = db.select().from(horarioFixo).all()
    const turmasPorDisc = new Map<number, number>()
    for (const dt of db.select().from(disciplinaTurma).all()) turmasPorDisc.set(dt.disciplinaId, (turmasPorDisc.get(dt.disciplinaId) ?? 0) + 1)
    const feriados = new Set(db.select().from(feriado).all().map((f) => f.data))
    let esperado = 0
    let esperadoFeriado = 0
    for (const data of datasEntre('2026-08-03', '2026-12-12')) {
      for (const h of horarios.filter((x) => x.diaSemana === diaDaSemana(data))) {
        const n = turmasPorDisc.get(h.disciplinaId) ?? 0
        esperado += n
        if (feriados.has(data)) esperadoFeriado += n
      }
    }
    const todas = db.select().from(aula).all()
    expect(todas.length).toBe(esperado)
    expect(todas.filter((a) => a.status === 'feriado').length).toBe(esperadoFeriado)
    expect(todas.every((a) => ![0, 6].includes(diaDaSemana(a.data)))).toBe(true)
    expect(new Set(todas.map((a) => `${a.turmaId}|${a.data}|${a.horario}`)).size).toBe(todas.length)
    expect(db.select().from(aula).where(eq(aula.data, '2026-11-20')).all().every((a) => a.status === 'feriado')).toBe(true)
  })

  it('CA-02 / RN-11: uma noite compartilhada forma um grupo com os dois horários de todas as turmas', async () => {
    const amb = await criarAmbiente()
    const linhas = [...amb.aulasEm('SI 4º', '2026-11-23', 1), ...amb.aulasEm('SI 4º', '2026-11-23', 2), ...amb.aulasEm('ADS 4º', '2026-11-23', 1), ...amb.aulasEm('ADS 4º', '2026-11-23', 2)]
    expect(linhas).toHaveLength(4)
    expect(new Set(linhas.map((l) => l.grupo)).size).toBe(1)
    expect(linhas.every((l) => l.disciplinaPrevistaId === amb.idDisciplina('Ética e Legislação em TI'))).toBe(true)
  })

  it('RN-11: nenhum professor tem só um horário numa noite', async () => {
    const amb = await criarAmbiente()
    const porNoite = new Map<string, Set<number>>()
    for (const a of amb.db.select().from(aula).all()) {
      const k = `${a.professorAtualId}|${a.turmaId}|${a.data}`
      porNoite.set(k, (porNoite.get(k) ?? new Set()).add(a.horario))
    }
    expect([...porNoite.values()].every((h) => h.size === 2)).toBe(true)
  })
})
