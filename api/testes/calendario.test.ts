import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { aula, feriado, horarioFixo, disciplinaTurma } from '../src/db/schema.js'
import { datasEntre, diaDaSemana } from '../src/compartilhado/horarios.js'
import { criarAmbiente } from './ambiente.js'

describe('Calendário', () => {
  it('CA-01: gera uma aula por turma, data e horário fixo, marcando feriados', async () => {
    const amb = await criarAmbiente()
    const { db } = amb

    // Conferência "manual": conta as ocorrências esperadas a partir do cadastro.
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
    expect(todas.every((a) => a.data >= '2026-08-03' && a.data <= '2026-12-12')).toBe(true)
    // Nenhuma aula em sábado ou domingo e nenhuma duplicada por turma/data/horário
    expect(todas.every((a) => ![0, 6].includes(diaDaSemana(a.data)))).toBe(true)
    expect(new Set(todas.map((a) => `${a.turmaId}|${a.data}|${a.horario}`)).size).toBe(todas.length)
    // 20/11 é feriado: todas as aulas desse dia estão marcadas
    expect(db.select().from(aula).where(eq(aula.data, '2026-11-20')).all().every((a) => a.status === 'feriado')).toBe(true)
  })

  it('CA-02: disciplina compartilhada gera uma aula por turma, no mesmo grupo', async () => {
    const amb = await criarAmbiente()
    const si = amb.aulaEm('SI 4º', '2026-11-27', 1)
    const ads = amb.aulaEm('ADS 4º', '2026-11-27', 1)
    const etica = amb.idDisciplina('Ética e Legislação em TI')
    expect(si.disciplinaPrevistaId).toBe(etica)
    expect(ads.disciplinaPrevistaId).toBe(etica)
    expect(si.grupo).toBe(ads.grupo)
    expect(si.id).not.toBe(ads.id)
  })
})
