import { useEffect, useRef } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/cliente'
import { useSessao } from '../api/sessao'
import { useTempoReal } from '../api/tempoReal'
import { useToast } from './ui'

/** Moldura das telas autenticadas: menu lateral, usuário e avisos em tempo real (RF-19). */
export function Layout() {
  const { usuario, sair } = useSessao()
  const toast = useToast()
  const conectado = useTempoReal()

  const { data: pendentes = [] } = useQuery({
    queryKey: ['pedidos', 'recebidos', 'pendente'],
    queryFn: () => api<any[]>('/pedidos?caixa=recebidos&status=pendente'),
  })
  const { data: enviados = [] } = useQuery({
    queryKey: ['pedidos', 'enviados'],
    queryFn: () => api<any[]>('/pedidos?caixa=enviados'),
  })

  // Avisos: novo pedido recebido e resposta a pedido enviado.
  const anteriores = useRef<{ recebidos: Set<number>; enviados: Map<number, string> } | null>(null)
  useEffect(() => {
    const recebidos = new Set(pendentes.map((p) => p.id))
    const envs = new Map(enviados.map((p) => [p.id, p.status as string]))
    const ant = anteriores.current
    if (ant) {
      for (const p of pendentes) if (!ant.recebidos.has(p.id)) toast(`Novo pedido de troca de ${p.solicitante}`, 'info')
      for (const p of enviados) {
        const antes = ant.enviados.get(p.id)
        if (antes === 'pendente' && p.status !== 'pendente') toast(`${p.destinatario}: pedido ${p.status}`, p.status === 'aprovado' ? 'sucesso' : 'info')
      }
    }
    anteriores.current = { recebidos, enviados: envs }
  }, [pendentes, enviados, toast])

  const itens = [
    { para: '/', rotulo: 'Minha grade', fim: true },
    { para: '/solicitar', rotulo: 'Solicitar troca' },
    { para: '/pedidos', rotulo: 'Pedidos', contador: pendentes.length },
    { para: '/saldo', rotulo: 'Saldo e histórico' },
    ...(usuario?.papel === 'admin' ? [{ para: '/cadastros', rotulo: 'Cadastros' }] : []),
  ]

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">PA</div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Permuta Acadêmica</div>
            <div className="text-xs text-slate-500">SI e ADS · noite</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {itens.map((i) => (
            <NavLink
              key={i.para}
              to={i.para}
              end={i.fim}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
              }
            >
              {i.rotulo}
              {!!i.contador && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{i.contador}</span>}
            </NavLink>
          ))}
          <a href="/tv" target="_blank" className="flex rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Painel da TV ↗
          </a>
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="text-sm font-medium text-slate-800">{usuario?.nome}</div>
          <div className="text-xs text-slate-500">{usuario?.papel === 'admin' ? 'Coordenação' : 'Professor(a)'}</div>
          <div className="mt-3 flex items-center justify-between">
            <span className={`flex items-center gap-1.5 text-xs ${conectado ? 'text-emerald-600' : 'text-slate-400'}`}>
              <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              {conectado ? 'Tempo real' : 'Reconectando…'}
            </span>
            <button onClick={sair} className="text-xs font-medium text-slate-500 hover:text-slate-800">
              Sair
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
