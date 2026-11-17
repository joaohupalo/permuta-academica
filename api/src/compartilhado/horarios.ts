/** Datas são sempre strings 'AAAA-MM-DD' no horário local. */

export const HORARIOS = {
  1: { inicio: '19:10', fim: '20:25' },
  2: { inicio: '20:45', fim: '22:00' },
} as const

export type NumeroHorario = 1 | 2

export const NOMES_DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

const pad = (n: number) => String(n).padStart(2, '0')

export function paraISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function deISO(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function somarDias(iso: string, dias: number): string {
  const d = deISO(iso)
  d.setDate(d.getDate() + dias)
  return paraISO(d)
}

/** 0 = domingo ... 6 = sábado */
export function diaDaSemana(iso: string): number {
  return deISO(iso).getDay()
}

/** Segunda-feira da semana a exibir. Sábado e domingo apontam para a semana seguinte. */
export function segundaDaSemana(iso: string): string {
  const dia = diaDaSemana(iso)
  if (dia === 0) return somarDias(iso, 1)
  if (dia === 6) return somarDias(iso, 2)
  return somarDias(iso, 1 - dia)
}

function momento(iso: string, hhmm: string): Date {
  const d = deISO(iso)
  const [h, m] = hhmm.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d
}

export function inicioDaAula(data: string, horario: number): Date {
  return momento(data, HORARIOS[horario as NumeroHorario].inicio)
}

export function fimDaAula(data: string, horario: number): Date {
  return momento(data, HORARIOS[horario as NumeroHorario].fim)
}

export function formatarData(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export function descreverHorario(horario: number): string {
  const h = HORARIOS[horario as NumeroHorario]
  return `${horario}º horário (${h.inicio}–${h.fim})`
}

export function* datasEntre(inicio: string, fim: string): Generator<string> {
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) yield d
}
