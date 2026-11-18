import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, post } from '../../api/cliente'
import { useSessao } from '../../api/sessao'
import { descreverNoite, hoje, inicioDaAula, somarDias } from '../../api/formato'
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
      <Titulo titulo="Solicitar troca de aula" subtitulo="As trocas são sempre da noite inteira (2 aulas). Só valem após a aprovação do colega; enquanto isso, as noites envolvidas ficam travadas." />
      <Abas<Tipo>
        abas={[
          { id: 'compensatoria', rotulo: 'Compensatória' },
          { id: 'pontual', rotulo: 'Pontual' },
          { id: 'reposicao', rotulo: 'Reposição em noite vaga' },
        ]}
        ativa={tipo}
        aoMudar={setTipo}
      />
      {tipo === 'reposicao' ? (
        <FormReposicao disciplinaInicial={Number(params.get('disciplina')) || null} turmaInicial={Number(params.get('turma')) || null} />
      ) : (
        <FormTroca
          key={tipo}
          tipo={tipo}
          aulaInicial={Number(params.get('aula')) || null}
          acerto={tipo === 'pontual' && params.get('para') ? { para: Number(params.get('para')), disciplina: Number(params.get('disciplina')), turma: Number(params.get('turma')) } : null}
        />
      )}
    </div>
  )
}

/** acerto: atalho do acerto de contas — ceder uma noite a quem deve (RF-20). */
function FormTroca({ tipo, aulaInicial, acerto }: { tipo: 'compensatoria' | 'pontual'; aulaInicial: number | null; acerto: { para: number; disciplina: number; turma: number } | null }) {
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
    const m = new Map<string, AulaGrade & { turmas: string[]; turmaIds: number[] }>()
    for (const a of aulas) {
      if (a.professorAtualId !== usuario!.id || a.status !== 'normal' || a.travada || inicioDaAula(a.data, a.horario) <= new Date()) continue
      const g = m.get(a.grupo)
      if (g) (g.turmas.push(a.turma), g.turmaIds.push(a.turmaId))
      else m.set(a.grupo, { ...a, turmas: [a.turma], turmaIds: [a.turmaId] })
    }
    // No acerto de contas, só noites da turma em que existe a dívida.
    return [...m.values()].filter((a) => !acerto || a.turmaIds.includes(acerto.turma))
  }, [aulas, usuario, acerto])
  const aula = minhas.find((a) => a.id === aulaId) ?? null

  const { data: candidatos = [], isFetching: buscandoColegas, error: erroColegas } = useQuery({
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
    const doAcerto = acerto && colega?.disciplinas.find((d: any) => d.id === acerto.disciplina)
    setDisciplinaDestinoId(doAcerto ? doAcerto.id : colega?.disciplinas.length === 1 ? colega.disciplinas[0].id : null)
  }, [destinatarioId]) // eslint-disable-line react-hooks/exhaustive-deps
  // No acerto de contas, o colega já vem escolhido assim que a lista carrega.
  useEffect(() => {
    if (acerto && !destinatarioId && candidatos.some((c) => c.professorId === acerto.para && c.disponivel)) setDestinatarioId(acerto.para)
  }, [candidatos]) // eslint-disable-line react-hooks/exhaustive-deps

  const disciplinaDestino = colega?.disciplinas.find((d: any) => d.id === disciplinaDestinoId)
  // Noite compartilhada: as turmas que a disciplina do colega não atende ficam sem aula (RN-02) e viram débito seu.
  const discQueEntra = tipo === 'compensatoria' ? colega?.disciplinas.find((d: any) => d.nome === pedida?.disciplina) : disciplinaDestino
  const ficamSemAula = aula && discQueEntra ? [...new Set(aula.turmas)].filter((t) => !discQueEntra.turmas.includes(t)) : []
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
        {acerto && <Aviso tipo="info">Acerto de contas: escolha uma noite sua para ceder ao colega. Ao ser aprovada, os dois ficam mais perto do 0.</Aviso>}
        <Cartao>
          <Campo rotulo={tipo === 'compensatoria' ? '1. Noite que você vai ceder' : '1. Noite que você vai ceder ao colega'}>
            <select className={classeEntrada} value={aulaId ?? ''} onChange={(e) => setAulaId(Number(e.target.value) || null)}>
              <option value="">Escolha uma das suas próximas noites…</option>
              {minhas.map((a) => (
                <option key={a.id} value={a.id}>
                  {[...new Set(a.turmas)].join(' + ')} · {descreverNoite(a.data)} · {a.disciplinaAtual}
                </option>
              ))}
            </select>
          </Campo>
          {aulaInicial && !aula && aulas.length > 0 && <p className="mt-2 text-sm text-amber-700">A noite escolhida na grade não está mais disponível para troca.</p>}
        </Cartao>

        {aula && (
          <Cartao>
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              2. Colegas livres em {descreverNoite(aula.data)}
            </div>
            {buscandoColegas && <p className="text-sm text-slate-500">Buscando…</p>}
            {erroColegas && <Aviso>{(erroColegas as Error).message}</Aviso>}
            {!buscandoColegas && !erroColegas && !disponiveis.length && <Vazio>Nenhum colega das turmas desta noite está livre nos dois horários.</Vazio>}
            <div className="space-y-2">
              {disponiveis.map((c) => (
                <label
                  key={c.professorId}
                  className={`flex cursor-pointer items-center gap-3 rounded border p-3 ${destinatarioId === c.professorId ? 'border-marca-500 bg-marca-50' : 'border-divisa hover:bg-slate-50'}`}
                >
                  <input type="radio" checked={destinatarioId === c.professorId} onChange={() => setDestinatarioId(c.professorId)} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{c.nome}</div>
                    <div className="text-xs text-slate-500">{c.disciplinas.map((d: any) => `${d.nome} (${[...new Set(d.turmas)].join(', ')})`).join(' · ')}</div>
                  </div>
                  <span className="text-xs font-medium text-emerald-600">✓ Disponível</span>
                </label>
              ))}
            </div>
            {ocupados > 0 && <p className="mt-2 text-xs text-slate-400">{ocupados} colega(s) da turma já têm aula nessa noite e não aparecem.</p>}
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
            <Campo rotulo={`3. Noite de ${colega.nome} que você assume em troca`}>
              <select className={classeEntrada} value={aulaPedidaId ?? ''} onChange={(e) => setAulaPedidaId(Number(e.target.value) || null)}>
                <option value="">{contrapartidas.length ? 'Escolha…' : 'Nenhuma noite do colega compatível (verifique choques de horário)'}</option>
                {contrapartidas.map((c) => (
                  <option key={c.aulaId} value={c.aulaId}>
                    {[...new Set(c.turmas)].join(' + ')} · {descreverNoite(c.data)} · {c.disciplina}
                  </option>
                ))}
              </select>
            </Campo>
          </Cartao>
        )}
      </div>

      <Cartao className="h-fit lg:sticky lg:top-8">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Resumo da troca</div>
        {!aula ? (
          <p className="text-sm text-slate-500">Escolha a aula para ver o resumo.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <Linha
              titulo={descreverNoite(aula.data)}
              antes={`${aula.disciplinaAtual} · ${usuario!.nome}`}
              depois={colega ? `${tipo === 'compensatoria' ? (pedida?.disciplina ?? '…') : (disciplinaDestino?.nome ?? '…')} · ${colega.nome}` : '…'}
            />
            {tipo === 'compensatoria' && pedida && <Linha titulo={descreverNoite(pedida.data)} antes={`${pedida.disciplina} · ${colega.nome}`} depois={`${aula.disciplinaAtual} · ${usuario!.nome}`} />}
            <div className="space-y-1 border-t border-slate-100 pt-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Choque de horário</span>
                <span className="font-medium text-emerald-600">verificado pelo sistema</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Impacto no saldo</span>
                <span className="font-medium text-slate-700">
                  {tipo === 'compensatoria' ? 'nenhum (permuta)' : colega ? `você −2 · ${colega.nome.split(' ')[0]} +2` : '—'}
                </span>
              </div>
            </div>
            {ficamSemAula.length > 0 && (
              <Aviso tipo="erro">
                Atenção: esta noite é compartilhada. {ficamSemAula.join(', ')} ficará sem aula, o que conta 2 aulas cedidas para você nessa turma.
              </Aviso>
            )}
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
    <div className="rounded bg-slate-50 p-3">
      <div className="font-medium text-texto">{titulo}</div>
      <div className="text-xs text-slate-400 line-through">{antes}</div>
      <div className="text-xs font-medium text-marca-700">→ {depois}</div>
    </div>
  )
}

function FormReposicao({ disciplinaInicial, turmaInicial }: { disciplinaInicial: number | null; turmaInicial: number | null }) {
  const { usuario } = useSessao()
  const toast = useToast()
  const [disciplinaId, setDisciplinaId] = useState<number | null>(disciplinaInicial)
  const [turmaId, setTurmaId] = useState<number | null>(turmaInicial)
  const [vagoChave, setVagoChave] = useState('')
  const [sala, setSala] = useState('')
  const [informativo, setInformativo] = useState<string[] | null>(null)

  const { data: disciplinas = [] } = useQuery({ queryKey: ['cadastros', 'disciplinas'], queryFn: () => api<any[]>('/disciplinas') })
  const { data: turmas = [] } = useQuery({ queryKey: ['turmas'], queryFn: () => api<any[]>('/turmas') })
  const minhas = disciplinas.filter((d) => d.professorId === usuario!.id)
  const disc = minhas.find((d) => d.id === disciplinaId)
  const { data: vagos = [], isFetching, error: erroVagos } = useQuery({
    queryKey: ['vagos', disciplinaId, turmaId],
    queryFn: () => api<any[]>(`/noites-vagas?disciplinaId=${disciplinaId}${turmaId ? `&turmaId=${turmaId}` : ''}`),
    enabled: !!disciplinaId,
  })
  const vago = vagos.find((v) => `${v.turmaId}|${v.data}` === vagoChave)

  const repor = useMutation({
    mutationFn: () => post('/reposicoes', { disciplinaId, turmaId: vago.turmaId, data: vago.data, sala: sala || undefined }),
    onSuccess: (r) => {
      toast('Reposição registrada (2 aulas).', 'sucesso')
      setVagoChave('')
      setInformativo(r.informativo)
    },
  })

  if (usuario!.papel === 'admin') return <Vazio>A reposição é registrada pelo próprio professor da disciplina.</Vazio>

  return (
    <div className="grid max-w-3xl gap-5">
      <Cartao>
        <p className="mb-4 text-sm text-slate-500">
          Ocupe uma noite sem aula da turma: livre na grade, vaga por troca ou cancelada. Serve para repor aulas que você deve ou para adiantar aulas (o crédito pode compensar o cancelamento de uma noite futura). A reposição é sempre da noite inteira, não precisa de aprovação e conta 2 aulas no seu saldo.
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
          <Campo rotulo="Noite vaga">
            <select className={classeEntrada} value={vagoChave} onChange={(e) => setVagoChave(e.target.value)}>
              <option value="">{isFetching ? 'Buscando…' : erroVagos ? 'Erro ao buscar noites vagas' : vagos.length ? 'Escolha…' : 'Nenhuma noite vaga encontrada'}</option>
              {vagos.map((v) => (
                <option key={`${v.turmaId}|${v.data}`} value={`${v.turmaId}|${v.data}`}>
                  {v.turma} · {descreverNoite(v.data)}
                  {v.observacao ? ` · ${v.observacao}` : ''}
                </option>
              ))}
            </select>
          </Campo>
          {erroVagos && <div className="mt-3"><Aviso>{(erroVagos as Error).message}</Aviso></div>}
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
