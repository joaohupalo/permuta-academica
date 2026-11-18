import { and, eq } from 'drizzle-orm'
import { abrirBanco } from '../src/db/conexao.js'
import { criarApp } from '../src/app.js'
import { aula, disciplina, turma } from '../src/db/schema.js'
import { cadastrarBase, emailDe } from '../src/carga.js'

/**
 * Ambiente de teste: banco em memória com a mesma grade da demonstração (sem histórico)
 * e relógio controlado. Por padrão, "agora" é segunda-feira, 16/11/2026, 10h.
 */
export async function criarAmbiente(agoraInicial = '2026-11-16T10:00:00') {
  const db = abrirBanco(':memory:')
  const base = cadastrarBase(db)
  const relogio = { atual: new Date(agoraInicial) }
  const app = criarApp({ db, agora: () => relogio.atual, segredoJwt: 'teste' })
  await app.ready()

  const tokens = new Map<string, string>()
  const token = async (nome: string) => {
    if (!tokens.has(nome)) {
      const email = nome === 'coordenacao' ? 'coordenacao@unimater.edu' : emailDe(nome)
      const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, senha: '123456' } })
      tokens.set(nome, r.json().token)
    }
    return tokens.get(nome)!
  }

  /** Requisição autenticada como a pessoa indicada. */
  const como = (nome: string) => {
    const req = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
      app.inject({ method, url: `/api${url}`, payload: payload as any, headers: { authorization: `Bearer ${await token(nome)}` } })
    return {
      get: (url: string) => req('GET', url),
      post: (url: string, payload: unknown = {}) => req('POST', url, payload),
      put: (url: string, payload: unknown) => req('PUT', url, payload),
      del: (url: string) => req('DELETE', url),
    }
  }

  const idPessoa = (nome: string) => base.pessoas.get(nome)!
  const idTurma = (nome: string) => base.turmas.get(nome)!
  const idDisciplina = (nome: string) => db.select().from(disciplina).where(eq(disciplina.nome, nome)).get()!.id
  const aulaEm = (nomeTurma: string, data: string, horario: number) =>
    db
      .select()
      .from(aula)
      .where(and(eq(aula.turmaId, idTurma(nomeTurma)), eq(aula.data, data), eq(aula.horario, horario)))
      .all()
      .find((a) => a.status !== 'cancelada')!
  const aulasEm = (nomeTurma: string, data: string, horario: number) =>
    db
      .select()
      .from(aula)
      .where(and(eq(aula.turmaId, idTurma(nomeTurma)), eq(aula.data, data), eq(aula.horario, horario)))
      .all()

  const saldoDe = async (nomeDisciplina: string, nomeTurma: string) => {
    const linhas = (await como('coordenacao').get('/saldo')).json() as any[]
    return linhas.find((l) => l.disciplina === nomeDisciplina && l.turma === nomeTurma)
  }

  return {
    db,
    app,
    relogio,
    base,
    como,
    idPessoa,
    idTurma,
    idDisciplina,
    aulaEm,
    aulasEm,
    saldoDe,
    turmas: () => db.select().from(turma).all(),
  }
}

export type Ambiente = Awaited<ReturnType<typeof criarAmbiente>>

/** Pedido compensatório do roteiro: Ana (BD II, quinta 26/11) ⇄ Bruno (Eng. Software, quarta 25/11), SI 4º. */
export async function pedidoAnaBruno(amb: Ambiente) {
  return amb.como('Ana Souza').post('/pedidos', {
    tipo: 'compensatoria',
    aulaId: amb.aulaEm('SI 4º', '2026-11-26', 1).id,
    destinatarioId: amb.idPessoa('Bruno Lima'),
    aulaPedidaId: amb.aulaEm('SI 4º', '2026-11-25', 1).id,
  })
}

/** Pedido pontual: Ana cede a noite de quinta 26/11 ao Bruno (Eng. Software). */
export async function pontualAnaBruno(amb: Ambiente) {
  return amb.como('Ana Souza').post('/pedidos', {
    tipo: 'pontual',
    aulaId: amb.aulaEm('SI 4º', '2026-11-26', 1).id,
    destinatarioId: amb.idPessoa('Bruno Lima'),
    disciplinaDestinoId: amb.idDisciplina('Engenharia de Software'),
  })
}
