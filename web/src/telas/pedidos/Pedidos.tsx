import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, post } from '../../api/cliente'
import { useSessao } from '../../api/sessao'
import { dataHora, descreverAula } from '../../api/formato'
import { Abas, Aviso, Botao, Cartao, Etiqueta, STATUS_PEDIDO, Titulo, Vazio, useToast } from '../../componentes/ui'
import { ModalInformativo } from '../../componentes/Informativo'

type Caixa = 'recebidos' | 'enviados' | 'todos'

/** Pedidos recebidos e enviados, com aprovação em um clique (RF-08, RF-14) e informativo (RF-15). */
export function Pedidos() {
  const [params, setParams] = useSearchParams()
  const caixa = (params.get('caixa') as Caixa) ?? 'recebidos'
  const [status, setStatus] = useState('')
  const [informativo, setInformativo] = useState<string[] | null>(null)
  const { usuario } = useSessao()

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos', caixa, status],
    queryFn: () => api<any[]>(`/pedidos?caixa=${caixa}${status ? `&status=${status}` : ''}`),
  })

  return (
    <div>
      <Titulo titulo="Pedidos" subtitulo="Solicitações de troca recebidas e enviadas. Tudo é atualizado sozinho." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Abas<Caixa>
          abas={[
            { id: 'recebidos', rotulo: 'Recebidos' },
            { id: 'enviados', rotulo: 'Enviados' },
            { id: 'todos', rotulo: 'Todos' },
          ]}
          ativa={caixa}
          aoMudar={(c) => setParams({ caixa: c })}
        />
        <div className="mb-5 flex flex-wrap gap-1">
          {['', 'pendente', 'aprovado', 'recusado', 'cancelado', 'expirado'].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
            >
              {s ? STATUS_PEDIDO[s].rotulo : 'Todos os status'}
            </button>
          ))}
        </div>
      </div>
      {isLoading && <p className="text-sm text-slate-500">Carregando…</p>}
      {!isLoading && !pedidos.length && <Vazio>Nenhum pedido aqui.</Vazio>}
      <div className="space-y-3">
        {pedidos.map((p) => (
          <CartaoPedido key={p.id} pedido={p} meuId={usuario!.id} aoVerInformativo={setInformativo} />
        ))}
      </div>
      <ModalInformativo textos={informativo} aoFechar={() => setInformativo(null)} />
    </div>
  )
}

function CartaoPedido({ pedido: p, meuId, aoVerInformativo }: { pedido: any; meuId: number; aoVerInformativo: (t: string[]) => void }) {
  const toast = useToast()
  const responder = useMutation({
    mutationFn: (acao: 'aprovar' | 'recusar' | 'cancelar') => post(`/pedidos/${p.id}/${acao}`),
    onSuccess: (r, acao) => {
      toast(acao === 'aprovar' ? 'Troca aprovada! A grade e a TV já foram atualizadas.' : acao === 'recusar' ? 'Pedido recusado.' : 'Pedido cancelado.', 'sucesso')
      if (acao === 'aprovar' && r.informativo) aoVerInformativo(r.informativo)
    },
  })
  const recebido = p.destinatarioId === meuId
  const enviado = p.solicitanteId === meuId
  const r = p.resumo
  const st = STATUS_PEDIDO[p.status]

  return (
    <Cartao className={p.status === 'pendente' && recebido ? 'border-amber-300' : ''}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Etiqueta cor={st.cor}>{st.rotulo}</Etiqueta>
            <Etiqueta cor="azul">{p.tipo === 'compensatoria' ? 'Compensatória' : 'Pontual'}</Etiqueta>
            <span className="text-sm text-slate-700">
              <strong>{p.solicitante}</strong> → <strong>{p.destinatario}</strong>
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded bg-slate-50 p-3">
              <div className="text-xs font-medium uppercase text-slate-500">{p.solicitante.split(' ')[0]} cede</div>
              <div className="font-medium">
                {r.ofertada.turmas.join(' + ')} · {descreverAula(r.ofertada.data, r.ofertada.horario)}
              </div>
              <div className="text-xs text-slate-500">
                era {r.ofertada.disciplina} → passa a {r.disciplinaDestino} ({p.destinatario})
              </div>
            </div>
            {r.pedida && (
              <div className="rounded bg-slate-50 p-3">
                <div className="text-xs font-medium uppercase text-slate-500">{p.solicitante.split(' ')[0]} assume</div>
                <div className="font-medium">
                  {r.pedida.turmas.join(' + ')} · {descreverAula(r.pedida.data, r.pedida.horario)}
                </div>
                <div className="text-xs text-slate-500">
                  era {r.pedida.disciplina} → passa a {r.ofertada.disciplina} ({p.solicitante})
                </div>
              </div>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Enviado em {dataHora(p.criadoEm)}
            {p.respondidoEm && ` · ${st.rotulo.toLowerCase()} em ${dataHora(p.respondidoEm)}`}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {p.status === 'pendente' && recebido && (
            <>
              <Botao disabled={responder.isPending} onClick={() => responder.mutate('aprovar')}>
                Aprovar troca
              </Botao>
              <Botao variante="secundario" disabled={responder.isPending} onClick={() => responder.mutate('recusar')}>
                Recusar
              </Botao>
            </>
          )}
          {p.status === 'pendente' && enviado && (
            <Botao variante="perigo" disabled={responder.isPending} onClick={() => responder.mutate('cancelar')}>
              Cancelar pedido
            </Botao>
          )}
          {p.status === 'aprovado' && p.informativo?.length > 0 && (
            <Botao variante="secundario" onClick={() => aoVerInformativo(p.informativo)}>
              Informativo
            </Botao>
          )}
        </div>
      </div>
      {responder.error && (
        <div className="mt-3">
          <Aviso>{(responder.error as Error).message}</Aviso>
        </div>
      )}
    </Cartao>
  )
}
