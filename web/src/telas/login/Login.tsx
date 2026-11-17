import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/cliente'
import { useSessao } from '../../api/sessao'
import { Aviso, Botao, Campo, classeEntrada } from '../../componentes/ui'

export function Login() {
  const { entrar } = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const { data: contas = [] } = useQuery({ queryKey: ['contas-demo'], queryFn: () => api<any[]>('/auth/contas-demo') })

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await entrar(email, senha)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-fundo p-6">
      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
        <form onSubmit={enviar} className="rounded-sm bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="mb-7 flex flex-col items-center text-center">
            <img src="/logo-unimater.png" alt="Unimater" className="mb-4 h-14" />
            <h1 className="text-xl font-normal text-texto">Permuta Acadêmica</h1>
            <p className="text-sm text-slate-500">Gestão de trocas de aula · SI e ADS</p>
          </div>
          <div className="space-y-4">
            <Campo rotulo="E-mail institucional">
              <input className={classeEntrada} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@unimater.edu" required />
            </Campo>
            <Campo rotulo="Senha">
              <input className={classeEntrada} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </Campo>
            {erro && <Aviso>{erro}</Aviso>}
            <Botao type="submit" disabled={enviando} className="w-full">
              {enviando ? 'Entrando…' : 'Entrar'}
            </Botao>
            <a href="/tv" className="block text-center text-sm text-marca-600 hover:underline">
              Abrir painel da TV (sem login)
            </a>
          </div>
        </form>
        <div className="rounded-sm border border-divisa bg-white/60 p-6">
          <h2 className="mb-1 text-sm font-medium text-texto">Contas da demonstração</h2>
          <p className="mb-3 text-xs text-slate-500">Senha de todas: 123456. Clique para preencher.</p>
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {contas.map((c) => (
              <button
                key={c.email}
                type="button"
                onClick={() => {
                  setEmail(c.email)
                  setSenha('123456')
                }}
                className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-white"
              >
                <span className="text-texto">{c.nome}</span>
                <span className="text-xs text-slate-500">{c.papel === 'admin' ? 'coordenação' : c.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
