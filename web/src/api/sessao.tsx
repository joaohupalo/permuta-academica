import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, post, token } from './cliente'

export interface Usuario {
  id: number
  nome: string
  email: string
  papel: 'admin' | 'professor'
}

interface Sessao {
  usuario: Usuario | null
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => void
}

const Contexto = createContext<Sessao>(null!)

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(!!token.ler())
  const qc = useQueryClient()

  useEffect(() => {
    if (token.ler())
      api<Usuario>('/auth/eu')
        .then(setUsuario)
        .catch(() => token.limpar())
        .finally(() => setCarregando(false))
    const expirou = () => setUsuario(null)
    window.addEventListener('sessao-expirada', expirou)
    return () => window.removeEventListener('sessao-expirada', expirou)
  }, [])

  const entrar = async (email: string, senha: string) => {
    const r = await post<{ token: string; usuario: Usuario }>('/auth/login', { email, senha })
    token.salvar(r.token)
    qc.clear()
    setUsuario(r.usuario)
  }
  const sair = () => {
    token.limpar()
    qc.clear()
    setUsuario(null)
  }
  return <Contexto.Provider value={{ usuario, carregando, entrar, sair }}>{children}</Contexto.Provider>
}

export const useSessao = () => useContext(Contexto)
