import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/cliente'
import { useTempoReal } from '../../api/tempoReal'
import { dataCurta, hoje } from '../../api/formato'

interface AulaPainel {
  turmaId: number
  data: string
  horario: number
  sala: string
  tipo: string
  disciplina: string | null
  professor: string | null
  previsto: { disciplina: string; professor: string } | null
  motivo: string | null
}

const ESTILO: Record<string, { caixa: string; tag?: string; tagCor?: string }> = {
  normal: { caixa: 'bg-[#0b2f50] border-[#15446c]' },
  troca: { caixa: 'bg-amber-500/15 border-amber-400', tag: 'TROCA', tagCor: 'bg-amber-400 text-slate-950' },
  reposicao: { caixa: 'bg-teal-500/15 border-teal-400', tag: 'REPOSIÇÃO', tagCor: 'bg-teal-400 text-slate-950' },
  vaga: { caixa: 'bg-[#06223b] border-[#15446c] border-dashed', tag: 'SEM AULA', tagCor: 'bg-slate-500 text-white' },
  cancelada: { caixa: 'bg-red-500/15 border-red-400', tag: 'CANCELADA', tagCor: 'bg-red-500 text-white' },
  feriado: { caixa: 'bg-violet-500/10 border-violet-500/40' },
}

/**
 * Painel da TV do saguão (RF-16): semana inteira de SI e ADS numa tela, alto contraste,
 * atualização em tempo real, rolagem automática e virada sozinha à meia-noite.
 */
export function PainelTV() {
  const [params] = useSearchParams()
  const dataFixa = params.get('data')
  const [agora, setAgora] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const dia = dataFixa ?? hoje() // muda sozinho à meia-noite → nova consulta → nova semana

  const conectado = useTempoReal()
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ['painel', dia],
    queryFn: () => api<any>(`/painel?data=${dia}`),
    refetchInterval: 60_000,
  })

  // Rolagem automática quando a grade não cabe na tela.
  const rolagem = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = rolagem.current
    if (!el) return
    let direcao = 1
    let pausa = 0
    const t = setInterval(() => {
      if (el.scrollHeight <= el.clientHeight + 4) return
      if (pausa > 0) return void pausa--
      el.scrollTop += direcao
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1 || el.scrollTop <= 0) {
        direcao *= -1
        pausa = 120
      }
    }, 40)
    return () => clearInterval(t)
  }, [data])

  if (!data) return <div className="flex h-screen items-center justify-center bg-[#041c31] text-2xl text-slate-300">Carregando painel…</div>

  const mapa = new Map<string, AulaPainel>((data.aulas as AulaPainel[]).map((a) => [`${a.turmaId}|${a.data}|${a.horario}`, a]))
  // "Hoje" e dias passados seguem sempre o relógio real; ?data= só escolhe qual semana mostrar.
  const hojeISO = hoje()

  return (
    <div className="flex h-screen flex-col bg-[#041c31] text-white">
      <header className="flex items-end justify-between px-8 pt-6 pb-4">
        <div className="flex items-end gap-5">
          <div className="rounded-md bg-white px-3 py-2">
            <img src="/logo-unimater.png" alt="Unimater" className="h-12" />
          </div>
          <div>
          <div className="text-sm font-semibold tracking-[0.2em] text-marca-300 uppercase">Bloco de Sistemas · Turno da noite</div>
          <h1 className="text-4xl font-bold">
            Aulas da semana <span className="text-slate-400">· {dataCurta(data.semana.inicio)} a {dataCurta(data.semana.fim)}</span>
          </h1>
          </div>
        </div>
        <div className="text-right">
          <div className="text-6xl font-bold tabular-nums">{agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="text-lg text-slate-400 capitalize">{agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
        </div>
      </header>

      <div ref={rolagem} className="flex-1 overflow-hidden px-8">
        <table className="w-full table-fixed border-separate border-spacing-1.5">
          <thead className="sticky top-0 z-10 bg-[#041c31]">
            <tr>
              <th className="w-28" />
              <th className="w-24" />
              {data.dias.map((d: any) => (
                <th
                  key={d.data}
                  className={`rounded-lg px-3 py-2 text-left ${d.data === hojeISO ? 'bg-marca-500' : d.feriado ? 'bg-violet-900/60' : 'bg-marca-900'} ${d.data < hojeISO ? 'opacity-50' : ''}`}
                >
                  <div className="text-xl font-bold capitalize">
                    {d.nome.replace('-feira', '')} <span className="font-normal text-white/70">{dataCurta(d.data)}</span>
                  </div>
                  {d.data === hojeISO && <div className="text-xs font-semibold tracking-wider uppercase">Hoje</div>}
                  {d.feriado && <div className="text-xs font-semibold text-violet-200">Feriado · {d.feriado}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.turmas.map((t: any) =>
              [1, 2].map((h) => (
                <tr key={`${t.id}|${h}`}>
                  {h === 1 && (
                    <td rowSpan={2} className="rounded-lg bg-marca-900 px-3 py-2 align-middle">
                      <div className="text-2xl font-bold">{t.nome}</div>
                      <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">{t.curso}</div>
                    </td>
                  )}
                  <td className="rounded-lg bg-[#082741] px-2 py-2 text-center align-middle text-sm text-slate-300 tabular-nums">
                    {data.horarios[h].inicio}
                    <br />
                    {data.horarios[h].fim}
                  </td>
                  {data.dias.map((d: any) => {
                    const a = mapa.get(`${t.id}|${d.data}|${h}`)
                    const passado = d.data < hojeISO
                    if (!a)
                      return (
                        <td key={d.data} className={`rounded-lg border border-dashed border-[#15446c] px-3 py-2 text-sm text-slate-500 ${passado ? 'opacity-40' : ''}`}>
                          —
                        </td>
                      )
                    const e = ESTILO[a.tipo]
                    return (
                      <td key={d.data} className={`rounded-lg border-2 px-3 py-2 align-top ${e.caixa} ${passado ? 'opacity-40' : ''} ${d.data === hojeISO ? 'ring-2 ring-marca-400/70' : ''}`}>
                        {a.tipo === 'feriado' ? (
                          <div className="text-base text-violet-300">Feriado</div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <div className={`text-lg leading-tight font-semibold ${a.tipo === 'cancelada' ? 'line-through decoration-2' : ''}`}>
                                {a.tipo === 'vaga' ? 'Sem aula' : a.disciplina}
                              </div>
                              {e.tag && <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${e.tagCor}`}>{e.tag}</span>}
                            </div>
                            {a.tipo !== 'vaga' && (
                              <div className="mt-0.5 text-sm text-slate-300">
                                {a.professor}
                                {a.sala && <span className="text-slate-500"> · {a.sala}</span>}
                              </div>
                            )}
                            {a.previsto && <div className="mt-1 text-xs text-slate-400">no lugar de {a.previsto.disciplina}</div>}
                          </>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <footer className="flex items-center justify-between px-8 py-3 text-sm text-slate-400">
        <div className="flex gap-5">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-amber-400" /> Troca entre professores
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-teal-400" /> Reposição
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-red-500" /> Cancelada
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-emerald-400' : 'bg-slate-500'}`} />
          {conectado ? 'Atualização em tempo real' : 'Reconectando…'} · última às {new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          {dataFixa && <span className="ml-2 rounded bg-amber-500/20 px-2 text-amber-300">semana fixada: {dataCurta(data.semana.inicio)} a {dataCurta(data.semana.fim)}</span>}
        </div>
      </footer>
    </div>
  )
}
