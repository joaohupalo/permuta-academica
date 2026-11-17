import { createContext, useCallback, useContext, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

/** Peças visuais reutilizáveis (botões, cartões, etiquetas, modal, abas, avisos). */

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma'
const estilos: Record<Variante, string> = {
  primario: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300',
  secundario: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  perigo: 'bg-white text-red-700 border border-red-200 hover:bg-red-50 disabled:text-red-300',
  fantasma: 'text-slate-600 hover:bg-slate-100',
}

export function Botao({ variante = 'primario', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${estilos[variante]} ${className}`}
    />
  )
}

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>{children}</div>
}

export function Titulo({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {acoes}
    </div>
  )
}

const cores = {
  cinza: 'bg-slate-100 text-slate-700',
  azul: 'bg-indigo-100 text-indigo-800',
  verde: 'bg-emerald-100 text-emerald-800',
  ambar: 'bg-amber-100 text-amber-800',
  vermelho: 'bg-red-100 text-red-800',
  roxo: 'bg-violet-100 text-violet-800',
  teal: 'bg-teal-100 text-teal-800',
}
export type Cor = keyof typeof cores

export function Etiqueta({ cor = 'cinza', children }: { cor?: Cor; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${cores[cor]}`}>{children}</span>
}

export const TIPO_AULA: Record<string, { rotulo: string; cor: Cor }> = {
  normal: { rotulo: 'Normal', cor: 'cinza' },
  troca: { rotulo: 'Troca', cor: 'ambar' },
  reposicao: { rotulo: 'Reposição', cor: 'teal' },
  vaga: { rotulo: 'Sem aula', cor: 'cinza' },
  cancelada: { rotulo: 'Cancelada', cor: 'vermelho' },
  feriado: { rotulo: 'Feriado', cor: 'roxo' },
}

export const STATUS_PEDIDO: Record<string, { rotulo: string; cor: Cor }> = {
  pendente: { rotulo: 'Pendente', cor: 'ambar' },
  aprovado: { rotulo: 'Aprovado', cor: 'verde' },
  recusado: { rotulo: 'Recusado', cor: 'vermelho' },
  cancelado: { rotulo: 'Cancelado', cor: 'cinza' },
  expirado: { rotulo: 'Expirado', cor: 'cinza' },
}

export function Modal({ aberto, aoFechar, titulo, children, largura = 'max-w-lg' }: { aberto: boolean; aoFechar: () => void; titulo: string; children: ReactNode; largura?: string }) {
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={aoFechar}>
      <div className={`max-h-[90vh] w-full ${largura} overflow-y-auto rounded-2xl bg-white p-6 shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
          <button onClick={aoFechar} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Abas<T extends string>({ abas, ativa, aoMudar }: { abas: { id: T; rotulo: ReactNode }[]; ativa: T; aoMudar: (id: T) => void }) {
  return (
    <div className="mb-5 inline-flex rounded-lg bg-slate-100 p-1">
      {abas.map((a) => (
        <button
          key={a.id}
          onClick={() => aoMudar(a.id)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${ativa === a.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {a.rotulo}
        </button>
      ))}
    </div>
  )
}

export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-slate-400">{dica}</span>}
    </label>
  )
}

export const classeEntrada =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'

export function Aviso({ tipo = 'erro', children }: { tipo?: 'erro' | 'sucesso' | 'info'; children: ReactNode }) {
  const c = { erro: 'border-red-200 bg-red-50 text-red-800', sucesso: 'border-emerald-200 bg-emerald-50 text-emerald-800', info: 'border-indigo-200 bg-indigo-50 text-indigo-800' }[tipo]
  return <div className={`rounded-lg border px-4 py-3 text-sm ${c}`}>{children}</div>
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</div>
}

// ── Avisos rápidos (toasts) ──
interface Toast {
  id: number
  texto: string
  tipo: 'info' | 'sucesso' | 'erro'
}
const ToastCtx = createContext<(texto: string, tipo?: Toast['tipo']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Toast[]>([])
  const mostrar = useCallback((texto: string, tipo: Toast['tipo'] = 'info') => {
    const id = Date.now() + Math.random()
    setLista((l) => [...l, { id, texto, tipo }])
    setTimeout(() => setLista((l) => l.filter((t) => t.id !== id)), 5000)
  }, [])
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2">
        {lista.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg px-4 py-3 text-sm text-white shadow-lg ${t.tipo === 'erro' ? 'bg-red-600' : t.tipo === 'sucesso' ? 'bg-emerald-600' : 'bg-slate-800'}`}
          >
            {t.texto}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)
