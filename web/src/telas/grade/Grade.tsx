import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, post } from '../../api/cliente'
import { useSessao } from '../../api/sessao'
import { DIAS, HORARIOS, dataCurta, descreverNoite, hoje, inicioDaAula, segundaDe, somarDias } from '../../api/formato'
import { Aviso, Botao, Campo, Etiqueta, Modal, TIPO_AULA, Titulo, classeEntrada, useToast } from '../../componentes/ui'
import { ModalInformativo } from '../../componentes/Informativo'

export interface AulaGrade {
  id: number
  turmaId: number
  turma: string
  data: string
  horario: number
  sala: string
  status: string
  motivo: string | null
  tipo: string
  travada: boolean
  disciplinaAtual: string | null
  disciplinaPrevista: string | null
  professorAtual: string | null
  professorAtualId: number | null
  professorPrevisto: string | null
  professorPrevistoId: number | null
}

/** Minha grade: semana do professor (ou de uma turma), com trocas, travas e ações. */
export function Grade() {
  const { usuario } = useSessao()
  const navegar = useNavigate()
  const toast = useToast()
  const [segunda, setSegunda] = useState(() => segundaDe(hoje()))
  const [visao, setVisao] = useState<string>(usuario!.papel === 'admin' ? '' : 'minhas')
  const [selecionada, setSelecionada] = useState<AulaGrade | null>(null)
  const [motivo, setMotivo] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [informativo, setInformativo] = useState<string[] | null>(null)

  const { data: turmas = [] } = useQuery({ queryKey: ['turmas'], queryFn: () => api<any[]>('/turmas') })
  const turmaId = visao && visao !== 'minhas' ? visao : visao === '' ? String(turmas[0]?.id ?? '') : ''
  const sexta = somarDias(segunda, 4)
  const filtro = visao === 'minhas' ? `professorId=${usuario!.id}` : turmaId ? `turmaId=${turmaId}` : ''
  const { data: aulas = [], isLoading } = useQuery({
    queryKey: ['aulas', segunda, filtro],
    queryFn: () => api<AulaGrade[]>(`/aulas?inicio=${segunda}&fim=${sexta}&${filtro}`),
    enabled: !!filtro,
  })

  const porCelula = useMemo(() => {
    const m = new Map<string, AulaGrade[]>()
    for (const a of aulas) m.set(`${a.data}|${a.horario}`, [...(m.get(`${a.data}|${a.horario}`) ?? []), a])
    return m
  }, [aulas])

  const cancelar = useMutation({
    mutationFn: () => post(`/aulas/${selecionada!.id}/cancelar`, { motivo }),
    onSuccess: (r) => {
      toast('Noite cancelada (2 aulas).', 'sucesso')
      setSelecionada(null)
      setCancelando(false)
      setMotivo('')
      setInformativo(r.informativo)
    },
  })

  const podeAgir = (a: AulaGrade) => a.professorAtualId === usuario!.id && a.status === 'normal' && !a.travada && inicioDaAula(a.data, a.horario) > new Date()
  const dias = [0, 1, 2, 3, 4].map((i) => somarDias(segunda, i))

  return (
    <div>
      <Titulo
        titulo={visao === 'minhas' ? 'Minha grade' : 'Grade da turma'}
        subtitulo={`Semana de ${dataCurta(segunda)} a ${dataCurta(sexta)} · clique numa aula sua para trocar ou cancelar a noite`}
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-48">
            <select className={classeEntrada} value={visao || turmaId} onChange={(e) => setVisao(e.target.value)}>
              {usuario!.papel === 'professor' && <option value="minhas">Minhas aulas</option>}
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  Turma {t.nome}
                </option>
              ))}
            </select>
            </div>
            <Botao variante="secundario" onClick={() => setSegunda(somarDias(segunda, -7))}>
              ←
            </Botao>
            <Botao variante="secundario" onClick={() => setSegunda(segundaDe(hoje()))}>
              Hoje
            </Botao>
            <Botao variante="secundario" onClick={() => setSegunda(somarDias(segunda, 7))}>
              →
            </Botao>
          </div>
        }
      />

      <div className="overflow-x-auto rounded-sm bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <table className="w-full min-w-[900px] table-fixed border-collapse">
          <thead>
            <tr>
              <th className="w-28 border-b border-divisa p-3" />
              {dias.map((d) => (
                <th key={d} className={`border-b border-l border-divisa p-3 text-left ${d === hoje() ? 'bg-marca-50' : ''}`}>
                  <div className="text-xs font-medium uppercase text-slate-500">{DIAS[new Date(d + 'T12:00').getDay()]}</div>
                  <div className="text-sm font-medium text-texto">{dataCurta(d)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2].map((h) => (
              <tr key={h}>
                <td className="border-b border-divisa p-3 align-top">
                  <div className="text-sm font-medium text-slate-700">{h}º horário</div>
                  <div className="text-xs text-slate-500">
                    {HORARIOS[h].inicio}–{HORARIOS[h].fim}
                  </div>
                </td>
                {dias.map((d) => (
                  <td key={d} className={`h-32 border-b border-l border-divisa p-2 align-top ${d === hoje() ? 'bg-marca-50/40' : ''}`}>
                    <div className="space-y-2">
                      {(porCelula.get(`${d}|${h}`) ?? []).map((a) => (
                        <CartaoAula key={a.id} aula={a} meuId={usuario!.id} acionavel={podeAgir(a)} aoClicar={() => setSelecionada(a)} />
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isLoading && <p className="mt-3 text-sm text-slate-500">Carregando…</p>}

      <Modal aberto={!!selecionada} aoFechar={() => (setSelecionada(null), setCancelando(false))} titulo="Aula">
        {selecionada && (
          <div className="space-y-4">
            <div>
              <div className="text-lg font-medium">{selecionada.disciplinaAtual ?? 'Sem aula'}</div>
              <div className="text-sm text-slate-500">
                {selecionada.turma} · {descreverNoite(selecionada.data)} {selecionada.sala && `· ${selecionada.sala}`}
              </div>
              {selecionada.tipo !== 'normal' && (
                <div className="mt-2 text-sm text-slate-600">
                  <Etiqueta cor={TIPO_AULA[selecionada.tipo].cor}>{TIPO_AULA[selecionada.tipo].rotulo}</Etiqueta>{' '}
                  {selecionada.disciplinaPrevista && selecionada.tipo === 'troca' && `prevista: ${selecionada.disciplinaPrevista} (${selecionada.professorPrevisto})`}
                  {selecionada.motivo && `motivo: ${selecionada.motivo}`}
                </div>
              )}
            </div>
            {podeAgir(selecionada) ? (
              !cancelando ? (
                <div className="flex flex-wrap gap-2">
                  <Botao onClick={() => navegar(`/solicitar?aula=${selecionada.id}`)}>Trocar esta noite</Botao>
                  <Botao variante="perigo" onClick={() => setCancelando(true)}>
                    Cancelar a noite
                  </Botao>
                </div>
              ) : (
                <div className="space-y-3">
                  <Campo rotulo="Motivo do cancelamento" dica="Obrigatório. As duas aulas da noite passam a contar como débito a repor.">
                    <textarea className={classeEntrada} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  </Campo>
                  {cancelar.error && <Aviso>{(cancelar.error as Error).message}</Aviso>}
                  <div className="flex gap-2">
                    <Botao variante="perigo" disabled={cancelar.isPending} onClick={() => cancelar.mutate()}>
                      Confirmar cancelamento
                    </Botao>
                    <Botao variante="fantasma" onClick={() => setCancelando(false)}>
                      Voltar
                    </Botao>
                  </div>
                </div>
              )
            ) : (
              <Aviso tipo="info">
                {selecionada.travada
                  ? 'Esta aula está travada por um pedido pendente.'
                  : selecionada.professorAtualId !== usuario!.id
                    ? 'Só o professor desta aula pode trocá-la ou cancelá-la.'
                    : 'Esta aula não pode mais ser alterada.'}
              </Aviso>
            )}
          </div>
        )}
      </Modal>
      <ModalInformativo textos={informativo} aoFechar={() => setInformativo(null)} />
    </div>
  )
}

function CartaoAula({ aula: a, meuId, acionavel, aoClicar }: { aula: AulaGrade; meuId: number; acionavel: boolean; aoClicar: () => void }) {
  const cedida = a.professorPrevistoId === meuId && a.professorAtualId !== meuId && a.status !== 'feriado'
  const fundo =
    a.tipo === 'troca'
      ? 'border-amber-300 bg-amber-50'
      : a.tipo === 'reposicao'
        ? 'border-teal-300 bg-teal-50'
        : a.tipo === 'cancelada'
          ? 'border-red-200 bg-red-50 opacity-80'
          : a.tipo === 'feriado'
            ? 'border-violet-200 bg-violet-50'
            : a.tipo === 'vaga'
              ? 'border-dashed border-slate-300 bg-slate-50'
              : 'border-divisa bg-white'
  return (
    <button onClick={aoClicar} className={`w-full rounded border p-2 text-left transition hover:shadow-sm ${fundo} ${acionavel ? 'ring-marca-300 hover:ring-2' : ''}`}>
      <div className="flex items-start justify-between gap-1">
        <div className={`text-sm leading-tight font-medium ${a.tipo === 'cancelada' ? 'line-through' : ''}`}>{a.disciplinaAtual ?? 'Sem aula'}</div>
        {a.travada && <span title="Travada por pedido pendente">🔒</span>}
      </div>
      <div className="mt-0.5 text-xs text-slate-600">
        {a.turma}
        {a.professorAtual && ` · ${a.professorAtual}`}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {a.tipo !== 'normal' && <Etiqueta cor={TIPO_AULA[a.tipo].cor}>{TIPO_AULA[a.tipo].rotulo}</Etiqueta>}
        {cedida && <Etiqueta cor="vermelho">Você cedeu</Etiqueta>}
      </div>
      {a.tipo === 'troca' && a.disciplinaPrevista && <div className="mt-1 text-[11px] text-slate-500">no lugar de {a.disciplinaPrevista}</div>}
    </button>
  )
}
