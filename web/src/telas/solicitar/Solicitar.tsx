import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, post } from '../../api/cliente'
import { useSessao } from '../../api/sessao'
import { descreverAula, hoje, inicioDaAula, somarDias } from '../../api/formato'
import { Abas, Aviso, Botao, Campo, Cartao, Titulo, Vazio, classeEntrada, useToast } from '../../componentes/ui'
import { ModalInformativo } from '../../componentes/Informativo'
import type { AulaGrade } from '../grade/Grade'

type Tipo = 'compensatoria' | 'pontual' | 'reposicao'

/** Solicitar troca (RF-05, RF-06, RF-07) ou registrar reposição em horário vago (RF-09). */
export function Solicitar() {
  const [params] = useSearchParams()
  const [tipo, setTipo] = useState<Tipo>((params.get('tipo') as Tipo) ?? 'compensatoria')
  return (
    <div>
      <Titulo titulo="Solicitar troca de aula" subtitulo="A troca só é efetivada após a aprovação do colega. Enquanto estiver pendente, as aulas envolvidas ficam travadas." />
      <Abas<Tipo>
        abas={[
          { id: 'compensatoria', rotulo: 'Compensatória' },
          { id: 'pontual', rotulo: 'Pontual' },
          { id: 'reposicao', rotulo: 'Reposição em horário vago' },
        ]}
        ativa={tipo}
        aoMudar={setTipo}
      />
      {tipo === 'reposicao' ? <FormReposicao /> : <FormTroca key={tipo} tipo={tipo} aulaInicial={Number(params.get('aula')) || null} />}
    </div>
  )
}

function FormTroca({ tipo, aulaInicial }: { tipo: 'compensatoria' | 'pontual'; aulaInicial: number | null }) {
  const { usuario } = useSessao()
  const navegar = useNavigate()
  const toast = useToast()
  const [aulaId, setAulaId] = useState<number | null>(aulaInicial)
  const [destinatarioId, setDestinatarioId] = useState<number | null>(null)
  const [aulaPedidaId, setAulaPedidaId] = useState<number | null>(null)
  const [disciplinaDestinoId, setDisciplinaDestinoId] = useState<number | null>(null)

  const { data: aulas = [] } = useQuery({
    queryKey: ['aulas', 'minhas-futuras', usuario!.id],
    queryFn: () => api<(AulaGrade & { grupo: string })[]>(`/aulas?inicio=${hoje()}&fim=${somarDias(hoje(), 90)}&professorId=${usuario!.id}`),
  })
  // Uma opção por grupo (aula compartilhada aparece uma vez, com as turmas juntas).
  const minhas = useMemo(() => {
    const m = new Map<string, AulaGrade & { turmas: string[] }>()
    for (const a of aulas) {
      if (a.professorAtualId !== usuario!.id || a.status !== 'normal' || a.travada || inicioDaAula(a.data, a.horario) <= new Date()) continue
      const g = m.get(a.grupo)
      if (g) g.turmas.push(a.turma)
      else m.set(a.grupo, { ...a, turmas: [a.turma] })
    }
    return [...m.values()]
  }, [aulas, usuario])
  const aula = minhas.find((a) => a.id === aulaId) ?? null

  const { data: candidatos = [], isFetching: buscandoColegas } = useQuery({
    queryKey: ['candidatos', aulaId],
    queryFn: () => api<any[]>(`/aulas/${aulaId}/candidatos`),
    enabled: !!aula,
  })
  const colega = candidatos.find((c) => c.professorId === destinatarioId)
  const { data: contrapartidas = [] } = useQuery({
    queryKey: ['contrapartidas', aulaId, destinatarioId],
    queryFn: () => api<any[]>(`/aulas/${aulaId}/contrapartidas?professorId=${destinatarioId}`),
    enabled: tipo === 'compensatoria' && !!aula && !!destinatarioId,
  })
  const pedida = contrapartidas.find((c) => c.aulaId === aulaPedidaId)

  useEffect(() => {
    setDestinatarioId(null)
    setAulaPedidaId(null)
  }, [aulaId])
  useEffect(() => {
    setAulaPedidaId(null)
    setDisciplinaDestinoId(colega?.disciplinas.length === 1 ? colega.disciplinas[0].id : null)
  }, [destinatarioId]) // eslint-disable-line react-hooks/exhaustive-deps

  const disciplinaDestino = colega?.disciplinas.find((d: any) => d.id === disciplinaDestinoId)
  const pronto = !!aula && !!colega && (tipo === 'compensatoria' ? !!pedida : !!disciplinaDestino)

  const enviar = useMutation({
    mutationFn: () =>
      post('/pedidos', {
        tipo,
        aulaId,
        destinatarioId,
        ...(tipo === 'compensatoria' ? { aulaPedidaId } : { disciplinaDestinoId }),
      }),
    onSuccess: () => {
      toast('Pedido enviado. As aulas ficaram travadas até a resposta.', 'sucesso')
      navegar('/pedidos?caixa=enviados')
    },
  })

  const disponiveis = candidatos.filter((c) => c.disponivel)
  const ocupados = candidatos.length - disponiveis.length

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <Cartao>
          <Campo rotulo={tipo === 'compensatoria' ? '1. Aula que você vai ceder' : '1. Aula que você vai ceder ao colega'}>
            <select className={classeEntrada} value={aulaId ?? ''} onChange={(e) => setAulaId(Number(e.target.value) || null)}>
              <option value="">Escolha uma das suas próximas aulas…</option>
              {minhas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.turmas.join(' + ')} · {descreverAula(a.data, a.horario)} · {a.disciplinaAtual}
                </option>
              ))}
            </select>
          </Campo>
          {aulaInicial && !aula && aulas.length > 0 && <p className="mt-2 text-sm text-amber-700">A aula escolhida na grade não está mais disponível para troca.</p>}
        </Cartao>

        {aula && (
          <Cartao>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              2. Colegas disponíveis em {descreverAula(aula.data, aula.horario)}
            </div>
            {buscandoColegas && <p className="text-sm text-slate-500">Buscando…</p>}
            {!buscandoColegas && !disponiveis.length && <Vazio>Nenhum colega das turmas desta aula está livre nesse horário.</Vazio>}
            <div className="space-y-2">
              {disponiveis.map((c) => (
                <label
                  key={c.professorId}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${destinatarioId === c.professorId ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <input type="radio" checked={destinatarioId === c.professorId} onChange={() => setDestinatarioId(c.professorId)} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{c.nome}</div>
                    <div className="text-xs text-slate-500">{c.disciplinas.map((d: any) => `${d.nome} (${d.turmas.join(', ')})`).join(' · ')}</div>
                  </div>
                  <span className="text-xs font-medium text-emerald-600">✓ Disponível</span>
                </label>
              ))}
            </div>
            {ocupados > 0 && <p className="mt-2 text-xs text-slate-400">{ocupados} colega(s) da turma já têm aula nesse horário e não aparecem.</p>}
          </Cartao>
        )}

        {colega && tipo === 'pontual' && colega.disciplinas.length > 1 && (
          <Cartao>
            <Campo rotulo="3. Disciplina que o colega vai ministrar">
              <select className={classeEntrada} value={disciplinaDestinoId ?? ''} onChange={(e) => setDisciplinaDestinoId(Number(e.target.value) || null)}>
                <option value="">Escolha…</option>
                {colega.disciplinas.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.nome} ({d.turmas.join(', ')})
                  </option>
                ))}
              </select>
            </Campo>
          </Cartao>
        )}

        {colega && tipo === 'compensatoria' && (
          <Cartao>
            <Campo rotulo={`3. Aula de ${colega.nome} que você assume em troca`}>
              <select className={classeEntrada} value={aulaPedidaId ?? ''} onChange={(e) => setAulaPedidaId(Number(e.target.value) || null)}>
                <option value="">{contrapartidas.length ? 'Escolha…' : 'Nenhuma aula do colega compatível (verifique choques de horário)'}</option>
                {contrapartidas.map((c) => (
                  <option key={c.aulaId} value={c.aulaId}>
                    {c.turmas.join(' + ')} · {descreverAula(c.data, c.horario)} · {c.disciplina}
                  </option>
                ))}
              </select>
            </Campo>
          </Cartao>
        )}
      </div>

      <Cartao className="h-fit lg:sticky lg:top-8">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo da troca</div>
        {!aula ? (
          <p className="text-sm text-slate-500">Escolha a aula para ver o resumo.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <Linha
              titulo={descreverAula(aula.data, aula.horario)}
              antes={`${aula.disciplinaAtual} · ${usuario!.nome}`}
              depois={colega ? `${tipo === 'compensatoria' ? (pedida?.disciplina ?? '…') : (disciplinaDestino?.nome ?? '…')} · ${colega.nome}` : '…'}
            />
            {tipo === 'compensatoria' && pedida && <Linha titulo={descreverAula(pedida.data, pedida.horario)} antes={`${pedida.disciplina} · ${colega.nome}`} depois={`${aula.disciplinaAtual} · ${usuario!.nome}`} />}
            <div className="space-y-1 border-t border-slate-100 pt-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Choque de horário</span>
                <span className="font-medium text-emerald-600">verificado pelo sistema</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Impacto no saldo</span>
                <span className="font-medium text-slate-700">
                  {tipo === 'compensatoria' ? '0 (compensada)' : colega ? `você −1 · ${colega.nome.split(' ')[0]} +1` : '—'}
                </span>
              </div>
            </div>
            {enviar.error && <Aviso>{(enviar.error as Error).message}</Aviso>}
            <Botao className="w-full" disabled={!pronto || enviar.isPending} onClick={() => enviar.mutate()}>
              Enviar solicitação
            </Botao>
          </div>
        )}
      </Cartao>
    </div>
  )
}

function Linha({ titulo, antes, depois }: { titulo: string; antes: string; depois: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="font-semibold text-slate-800">{titulo}</div>
      <div className="text-xs text-slate-400 line-through">{antes}</div>
      <div className="text-xs font-medium text-indigo-700">→ {depois}</div>
    </div>
  )
}

function FormReposicao() {
  const { usuario } = useSessao()
  const toast = useToast()
  const [disciplinaId, setDisciplinaId] = useState<number | null>(null)
  const [turmaId, setTurmaId] = useState<number | null>(null)
  const [vagoChave, setVagoChave] = useState('')
  const [sala, setSala] = useState('')
  const [informativo, setInformativo] = useState<string[] | null>(null)

  const { data: disciplinas = [] } = useQuery({ queryKey: ['cadastros', 'disciplinas'], queryFn: () => api<any[]>('/disciplinas') })
  const { data: turmas = [] } = useQuery({ queryKey: ['turmas'], queryFn: () => api<any[]>('/turmas') })
  const minhas = disciplinas.filter((d) => d.professorId === usuario!.id)
  const disc = minhas.find((d) => d.id === disciplinaId)
  const { data: vagos = [], isFetching } = useQuery({
    queryKey: ['vagos', disciplinaId, turmaId],
    queryFn: () => api<any[]>(`/horarios-vagos?disciplinaId=${disciplinaId}${turmaId ? `&turmaId=${turmaId}` : ''}`),
    enabled: !!disciplinaId,
  })
  const vago = vagos.find((v) => `${v.turmaId}|${v.data}|${v.horario}` === vagoChave)

  const repor = useMutation({
    mutationFn: () => post('/reposicoes', { disciplinaId, turmaId: vago.turmaId, data: vago.data, horario: vago.horario, sala: sala || undefined }),
    onSuccess: (r) => {
      toast('Reposição registrada.', 'sucesso')
      setVagoChave('')
      setInformativo(r.informativo)
    },
  })

  if (usuario!.papel === 'admin') return <Vazio>A reposição é registrada pelo próprio professor da disciplina.</Vazio>

  return (
    <div className="grid max-w-3xl gap-5">
      <Cartao>
        <p className="mb-4 text-sm text-slate-500">
          Ocupe um horário sem aula da turma (horário livre na grade, que ficou vago por troca ou cuja aula foi cancelada). Não precisa de aprovação; a aula conta como assumida no seu saldo.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Disciplina">
            <select
              className={classeEntrada}
              value={disciplinaId ?? ''}
              onChange={(e) => {
                setDisciplinaId(Number(e.target.value) || null)
                setTurmaId(null)
                setVagoChave('')
              }}
            >
              <option value="">Escolha…</option>
              {minhas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Turma">
            <select className={classeEntrada} value={turmaId ?? ''} onChange={(e) => (setTurmaId(Number(e.target.value) || null), setVagoChave(''))} disabled={!disc}>
              <option value="">Todas as turmas da disciplina</option>
              {disc?.turmaIds.map((id: number) => (
                <option key={id} value={id}>
                  {turmas.find((t) => t.id === id)?.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </Cartao>
      {disciplinaId && (
        <Cartao>
          <Campo rotulo="Horário vago">
            <select className={classeEntrada} value={vagoChave} onChange={(e) => setVagoChave(e.target.value)}>
              <option value="">{isFetching ? 'Buscando…' : vagos.length ? 'Escolha…' : 'Nenhum horário vago encontrado'}</option>
              {vagos.map((v) => (
                <option key={`${v.turmaId}|${v.data}|${v.horario}`} value={`${v.turmaId}|${v.data}|${v.horario}`}>
                  {v.turma} · {descreverAula(v.data, v.horario)}
                  {v.observacao ? ` · ${v.observacao}` : ''}
                </option>
              ))}
            </select>
          </Campo>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Campo rotulo="Sala (opcional)">
              <input className={classeEntrada} value={sala} onChange={(e) => setSala(e.target.value)} placeholder="Ex.: Lab 3" />
            </Campo>
            <Botao disabled={!vago || repor.isPending} onClick={() => repor.mutate()}>
              Registrar reposição
            </Botao>
          </div>
          {repor.error && <div className="mt-3"><Aviso>{(repor.error as Error).message}</Aviso></div>}
        </Cartao>
      )}
      <ModalInformativo textos={informativo} aoFechar={() => setInformativo(null)} />
    </div>
  )
}
