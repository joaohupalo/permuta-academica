import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, CalendarDays, ChartColumn, CircleUserRound, Inbox, LogOut, Menu, Monitor, Settings, X } from 'lucide-react'
import { api } from '../api/cliente'
import { useSessao } from '../api/sessao'
import { useTempoReal } from '../api/tempoReal'
import { useToast } from './ui'

/**
 * Moldura das telas autenticadas, no visual do portal acadêmico da Unimater:
 * menu lateral claro com ícones, barra superior com o usuário e avisos em tempo real (RF-19).
 */
export function Layout() {
  const { usuario, sair } = useSessao()
  const toast = useToast()
  const conectado = useTempoReal()
  const [recolhido, setRecolhido] = useState(false)
  const [boasVindas, setBoasVindas] = useState(() => sessionStorage.getItem('permuta.boas-vindas') !== 'fechado')

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

  const grupos = [
    [
      { para: '/', rotulo: 'Minha grade', icone: CalendarDays, fim: true },
      { para: '/solicitar', rotulo: 'Solicitar troca', icone: ArrowLeftRight },
      { para: '/pedidos', rotulo: 'Pedidos', icone: Inbox, contador: pendentes.length },
      { para: '/saldo', rotulo: 'Saldo e histórico', icone: ChartColumn },
    ],
    ...(usuario?.papel === 'admin' ? [[{ para: '/cadastros', rotulo: 'Cadastros', icone: Settings }]] : []),
  ]

  const item = 'flex items-center gap-3 px-8 py-3 text-[15px] transition'

  return (
    <div className="flex min-h-screen">
      <aside className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-divisa bg-fundo transition-all ${recolhido ? 'w-[72px]' : 'w-[250px]'}`}>
        <div className="flex h-[58px] items-center justify-between border-b border-divisa px-5">
          {!recolhido && <img src="/logo-unimater.png" alt="Unimater" className="ml-10 h-[42px]" />}
          <button onClick={() => setRecolhido(!recolhido)} className="mx-auto text-slate-400 hover:text-texto" aria-label="Recolher menu">
            <Menu size={22} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          {grupos.map((g, i) => (
            <div key={i} className={i ? 'mt-4 border-t border-divisa pt-4' : ''}>
              {g.map((it) => (
                <NavLink
                  key={it.para}
                  to={it.para}
                  end={(it as any).fim}
                  title={it.rotulo}
                  className={({ isActive }) =>
                    `${item} ${recolhido ? 'justify-center !px-0' : ''} ${isActive ? 'border-l-[3px] border-marca-500 bg-white !pl-[29px] text-marca-900' : 'border-l-[3px] border-transparent text-[#8a8c8f] hover:bg-white hover:text-texto'}`
                  }
                >
                  <it.icone size={17} strokeWidth={1.8} className="shrink-0" />
                  {!recolhido && <span className="flex-1">{it.rotulo}</span>}
                  {!recolhido && !!(it as any).contador && <span className="rounded-full bg-red-500 px-2 text-xs font-medium text-white">{(it as any).contador}</span>}
                </NavLink>
              ))}
            </div>
          ))}
          <div className="mt-4 border-t border-divisa pt-4">
            <a href="/tv" target="_blank" title="Painel da TV" className={`${item} ${recolhido ? 'justify-center !px-0' : ''} border-l-[3px] border-transparent text-[#8a8c8f] hover:bg-white hover:text-texto`}>
              <Monitor size={17} strokeWidth={1.8} />
              {!recolhido && 'Painel da TV ↗'}
            </a>
          </div>
          <div className="mt-4 border-t border-divisa pt-4">
            <button onClick={sair} title="Sair" className={`${item} ${recolhido ? 'justify-center !px-0' : ''} w-full border-l-[3px] border-transparent text-[#8a8c8f] hover:bg-white hover:text-texto`}>
              <LogOut size={17} strokeWidth={1.8} className="text-red-500" />
              {!recolhido && 'Sair'}
            </button>
          </div>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[58px] items-center justify-end gap-6 px-8">
          <span className={`flex items-center gap-1.5 text-xs ${conectado ? 'text-emerald-600' : 'text-slate-400'}`} title="Atualização automática, sem recarregar a página">
            <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            {conectado ? 'Tempo real' : 'Reconectando…'}
          </span>
          <div className="flex items-center gap-3">
            <CircleUserRound size={34} strokeWidth={1.4} className="text-texto" />
            <div className="leading-tight">
              <div className="text-sm text-texto">
                {usuario?.nome} · {usuario?.papel === 'admin' ? 'Coordenação' : 'Professor(a)'}
              </div>
              <div className="text-[10px] text-slate-500">Centro Universitário Mater Dei - UNIMATER</div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-8 pt-6 pb-10">
          {boasVindas && (
            <div className="mb-6 flex items-center justify-between rounded-sm border border-[#c6ecdf] bg-menta px-4 py-3.5 text-sm text-texto">
              <span>
                {usuario?.nome}, seja bem-vindo(a) ao sistema de permuta de horários de SI e ADS.
              </span>
              <button
                onClick={() => {
                  sessionStorage.setItem('permuta.boas-vindas', 'fechado')
                  setBoasVindas(false)
                }}
                className="text-slate-400 hover:text-texto"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <Outlet />
        </main>

        <footer className="flex items-center justify-between border-t border-divisa px-8 py-5">
          <span className="text-xl font-medium tracking-tight text-marca-900">
            Permuta<span className="text-marca-700">Acadêmica</span>
          </span>
          <span className="text-xs text-slate-400">Sistemas de Informação · Análise e Desenvolvimento de Sistemas</span>
        </footer>
      </div>
    </div>
  )
}
