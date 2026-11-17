/** Cliente HTTP da API: envia o token e transforma erros em mensagens legíveis. */
const CHAVE_TOKEN = 'permuta.token'

export const token = {
  ler: () => localStorage.getItem(CHAVE_TOKEN),
  salvar: (t: string) => localStorage.setItem(CHAVE_TOKEN, t),
  limpar: () => localStorage.removeItem(CHAVE_TOKEN),
}

export class ErroApi extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem)
  }
}

export async function api<T = any>(caminho: string, opcoes: { method?: string; body?: unknown } = {}): Promise<T> {
  const t = token.ler()
  const res = await fetch(`/api${caminho}`, {
    method: opcoes.method ?? 'GET',
    headers: {
      ...(opcoes.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    body: opcoes.body !== undefined ? JSON.stringify(opcoes.body) : undefined,
  })
  const dados = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && t) {
      token.limpar()
      window.dispatchEvent(new Event('sessao-expirada'))
    }
    throw new ErroApi(res.status, dados?.erro ?? `Erro ${res.status}`)
  }
  return dados as T
}

export const post = <T = any>(caminho: string, body: unknown = {}) => api<T>(caminho, { method: 'POST', body })
export const put = <T = any>(caminho: string, body: unknown) => api<T>(caminho, { method: 'PUT', body })
export const del = <T = any>(caminho: string) => api<T>(caminho, { method: 'DELETE' })
