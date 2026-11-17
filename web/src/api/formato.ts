export const HORARIOS: Record<number, { inicio: string; fim: string }> = {
  1: { inicio: '19:10', fim: '20:25' },
  2: { inicio: '20:45', fim: '22:00' },
}
export const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
export const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const pad = (n: number) => String(n).padStart(2, '0')
export const paraISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const deISO = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}
export const hoje = () => paraISO(new Date())
export const somarDias = (iso: string, n: number) => {
  const d = deISO(iso)
  d.setDate(d.getDate() + n)
  return paraISO(d)
}
export const diaSemana = (iso: string) => deISO(iso).getDay()
export const segundaDe = (iso: string) => {
  const dia = diaSemana(iso)
  return somarDias(iso, dia === 0 ? 1 : dia === 6 ? 2 : 1 - dia)
}
export const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
export const descreverAula = (data: string, horario: number) =>
  `${DIAS_CURTOS[diaSemana(data)]} ${dataCurta(data)} · ${horario}º horário (${HORARIOS[horario].inicio}–${HORARIOS[horario].fim})`
export const inicioDaAula = (data: string, horario: number) => {
  const d = deISO(data)
  const [h, m] = HORARIOS[horario].inicio.split(':').map(Number)
  d.setHours(h, m)
  return d
}
export const dataHora = (isoCompleto: string) =>
  new Date(isoCompleto).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
