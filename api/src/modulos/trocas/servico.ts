import { and, eq, gte, inArray, isNull } from 'drizzle-orm'
import type { Contexto, Tx } from '../../contexto.js'
import { aula, disciplina, disciplinaTurma, feriado, pedido, semestre, turma, usuario } from '../../db/schema.js'
import { datasEntre, diaDaSemana, formatarData, inicioDaAula, paraISO } from '../../compartilhado/horarios.js'
import { conflito, invalido, naoEncontrado, proibido } from '../../compartilhado/erros.js'
import { registrar } from '../historico/registrar.js'
import { carregarNomes, gerarInformativo } from '../informativo/gerar.js'
import {
  type Aula,
  aulasDoGrupo,
  aulasPorIds,
  buscarAula,
  buscarDisciplina,
  exigirUtilizavel,
  professorOcupado,
  resumirGrupo,
  turmasDaDisciplina,
} from './consultas.js'

interface Usuario {
  id: number
  nome: string
}

const curto = (data: string, horario: number) => `${formatarData(data).slice(0, 5)} ${horario}º horário`

function nomeDe(tx: Tx, id: number) {
  return tx.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, id)).get()?.nome ?? '?'
}

/** Trava todas as aulas do grupo para o pedido. Se alguma já estiver travada, nada é gravado (RN-04, RN-09). */
function travarGrupo(tx: Tx, grupo: string, pedidoId: number, esperado: number) {
  const r = tx
    .update(aula)
    .set({ pedidoPendenteId: pedidoId })
    .where(and(eq(aula.grupo, grupo), isNull(aula.pedidoPendenteId)))
    .run()
  if (r.changes !== esperado) throw conflito('Esta aula acabou de ser travada por outro pedido.')
}

/**
 * Coloca a disciplina nas aulas de um grupo (RN-02): cada turma atendida por ela recebe a aula;
 * as outras turmas ficam vagas e saem do grupo.
 */
function aplicarDisciplina(tx: Tx, linhas: Aula[], disciplinaId: number) {
  const d = buscarDisciplina(tx, disciplinaId)
  const atende = turmasDaDisciplina(tx, disciplinaId)
  for (const l of linhas) {
    if (atende.has(l.turmaId)) {
      tx.update(aula).set({ disciplinaAtualId: d.id, professorAtualId: d.professorId, status: 'normal' }).where(eq(aula.id, l.id)).run()
    } else {
      tx.update(aula)
        .set({ disciplinaAtualId: null, professorAtualId: null, status: 'vaga', grupo: `v|${l.id}` })
        .where(eq(aula.id, l.id))
        .run()
    }
  }
}

// ───────────────────────── Consultas para a tela de solicitação ─────────────────────────

/** RF-07 / CA-08: colegas das turmas da aula, com indicação de quem está livre naquele horário. */
export function candidatos(ctx: Contexto, usuarioId: number, aulaId: number) {
  const { db } = ctx
  const a = buscarAula(db, aulaId)
  if (a.professorAtualId !== usuarioId) throw proibido('Só o professor desta aula pode oferecê-la.')
  const turmasA = [...new Set(aulasDoGrupo(db, a.grupo).map((l) => l.turmaId))]
  const n = carregarNomes(db)

  const linhas = db
    .select({ id: disciplina.id, nome: disciplina.nome, professorId: disciplina.professorId, turmaId: disciplinaTurma.turmaId })
    .from(disciplina)
    .innerJoin(disciplinaTurma, eq(disciplinaTurma.disciplinaId, disciplina.id))
    .where(inArray(disciplinaTurma.turmaId, turmasA))
    .all()

  const porProfessor = new Map<number, { professorId: number; nome: string; disponivel: boolean; disciplinas: Map<number, { id: number; nome: string; turmas: string[] }> }>()
  for (const l of linhas) {
    if (l.professorId === usuarioId) continue
    const p = porProfessor.get(l.professorId) ?? {
      professorId: l.professorId,
      nome: n.pessoa(l.professorId)!,
      disponivel: !professorOcupado(db, l.professorId, a.data, a.horario, [a.grupo]),
      disciplinas: new Map(),
    }
    const d = p.disciplinas.get(l.id) ?? { id: l.id, nome: l.nome, turmas: [] }
    d.turmas.push(n.turma(l.turmaId))
    p.disciplinas.set(l.id, d)
    porProfessor.set(l.professorId, p)
  }
  return [...porProfessor.values()]
    .map((p) => ({ ...p, disciplinas: [...p.disciplinas.values()] }))
    .sort((x, y) => Number(y.disponivel) - Number(x.disponivel) || x.nome.localeCompare(y.nome))
}

/** Aulas do colega que podem entrar numa troca compensatória com a aula oferecida. */
export function contrapartidas(ctx: Contexto, usuarioId: number, aulaId: number, professorId: number) {
  const { db } = ctx
  const agora = ctx.agora()
  const a = buscarAula(db, aulaId)
  if (a.professorAtualId !== usuarioId) throw proibido('Só o professor desta aula pode oferecê-la.')
  const turmasA = [...new Set(aulasDoGrupo(db, a.grupo).map((l) => l.turmaId))]
  const atendeA = turmasDaDisciplina(db, a.disciplinaAtualId!)
  const n = carregarNomes(db)

  const linhas = db
    .select()
    .from(aula)
    .where(
      and(
        eq(aula.professorAtualId, professorId),
        eq(aula.status, 'normal'),
        isNull(aula.pedidoPendenteId),
        inArray(aula.turmaId, turmasA),
        gte(aula.data, paraISO(agora)),
      ),
    )
    .orderBy(aula.data, aula.horario)
    .all()

  const vistos = new Set<string>()
  const resultado = []
  for (const b of linhas) {
    if (vistos.has(b.grupo) || b.grupo === a.grupo) continue
    vistos.add(b.grupo)
    if (inicioDaAula(b.data, b.horario) <= agora) continue
    const grupoB = aulasDoGrupo(db, b.grupo)
    if (grupoB.some((x) => x.pedidoPendenteId)) continue
    if (!grupoB.some((x) => atendeA.has(x.turmaId))) continue
    if (professorOcupado(db, usuarioId, b.data, b.horario, [a.grupo, b.grupo])) continue
    resultado.push({
      aulaId: b.id,
      data: b.data,
      horario: b.horario,
      disciplina: n.disciplina(b.disciplinaAtualId),
      turmas: grupoB.map((x) => n.turma(x.turmaId)),
    })
  }
  return resultado
}

/** Horários vagos em que o professor pode repor uma aula da disciplina (RF-09). */
export function horariosVagos(ctx: Contexto, usuarioId: number, disciplinaId: number, turmaId?: number) {
  const { db } = ctx
  const agora = ctx.agora()
  const d = buscarDisciplina(db, disciplinaId)
  if (d.professorId !== usuarioId) throw proibido('Só o professor da disciplina pode repor aulas dela.')
  let turmas = [...turmasDaDisciplina(db, disciplinaId)]
  if (turmaId) turmas = turmas.filter((t) => t === turmaId)
  const sem = db.select().from(semestre).get()
  if (!sem || !turmas.length) return []

  const inicio = paraISO(agora) > sem.inicio ? paraISO(agora) : sem.inicio
  const feriados = new Set(db.select({ data: feriado.data }).from(feriado).all().map((f) => f.data))
  const existentes = new Map(
    db
      .select()
      .from(aula)
      .where(and(inArray(aula.turmaId, turmas), gte(aula.data, inicio)))
      .all()
      .map((l) => [`${l.turmaId}|${l.data}|${l.horario}`, l]),
  )
  const ocupado = new Set(
    db
      .select()
      .from(aula)
      .where(and(eq(aula.professorAtualId, usuarioId), eq(aula.status, 'normal'), gte(aula.data, inicio)))
      .all()
      .map((l) => `${l.data}|${l.horario}`),
  )
  const n = carregarNomes(db)
  const resultado = []
  for (const data of datasEntre(inicio, sem.fim)) {
    const dia = diaDaSemana(data)
    if (dia === 0 || dia === 6 || feriados.has(data)) continue
    for (const horario of [1, 2]) {
      if (inicioDaAula(data, horario) <= agora || ocupado.has(`${data}|${horario}`)) continue
      for (const t of turmas) {
        const l = existentes.get(`${t}|${data}|${horario}`)
        if (l && (l.status !== 'vaga' || l.pedidoPendenteId)) continue
        resultado.push({
          turmaId: t,
          turma: n.turma(t),
          data,
          horario,
          observacao: l ? `ficou vaga (era ${n.disciplina(l.disciplinaPrevistaId)})` : null,
        })
        if (resultado.length >= 120) return resultado
      }
    }
  }
  return resultado
}

// ───────────────────────── Operações ─────────────────────────

export interface EntradaPedido {
  tipo: 'compensatoria' | 'pontual'
  aulaId: number
  destinatarioId: number
  aulaPedidaId?: number
  disciplinaDestinoId?: number
}

/** RF-05, RF-06: cria o pedido e trava as aulas envolvidas (CA-03, CA-04, CA-09, CA-15). */
export function criarPedido(ctx: Contexto, u: Usuario, e: EntradaPedido) {
  const resultado = ctx.db.transaction((tx) => {
    const agora = ctx.agora()
    const a = buscarAula(tx, e.aulaId)
    if (a.professorAtualId !== u.id) throw proibido('Só o professor desta aula pode oferecê-la.')
    const grupoA = aulasDoGrupo(tx, a.grupo)
    grupoA.forEach((l) => exigirUtilizavel(l, agora))
    const turmasA = new Set(grupoA.map((l) => l.turmaId))
    if (e.destinatarioId === u.id) throw invalido('Escolha um colega diferente de você.')
    const destinatario = tx.select().from(usuario).where(eq(usuario.id, e.destinatarioId)).get()
    if (!destinatario) throw naoEncontrado('Professor não encontrado.')

    let disciplinaDestinoId: number
    let grupoB: Aula[] = []

    if (e.tipo === 'compensatoria') {
      if (!e.aulaPedidaId) throw invalido('Escolha a aula do colega que você vai assumir.')
      const b = buscarAula(tx, e.aulaPedidaId)
      if (b.professorAtualId !== e.destinatarioId) throw invalido('A aula escolhida não é do colega indicado.')
      if (b.grupo === a.grupo) throw invalido('Escolha uma aula diferente da sua.')
      grupoB = aulasDoGrupo(tx, b.grupo)
      grupoB.forEach((l) => exigirUtilizavel(l, agora))
      if (!grupoB.some((l) => turmasA.has(l.turmaId))) throw invalido('Trocas só podem acontecer entre professores da mesma turma.')
      const atendeA = turmasDaDisciplina(tx, a.disciplinaAtualId!)
      if (!grupoB.some((l) => atendeA.has(l.turmaId))) throw invalido('Sua disciplina não atende a turma da aula pedida.')
      if (professorOcupado(tx, e.destinatarioId, a.data, a.horario, [a.grupo, b.grupo]))
        throw conflito(`Choque de horário: ${destinatario.nome} já tem aula em ${curto(a.data, a.horario)}.`)
      if (professorOcupado(tx, u.id, b.data, b.horario, [a.grupo, b.grupo]))
        throw conflito(`Choque de horário: você já tem aula em ${curto(b.data, b.horario)}.`)
      disciplinaDestinoId = b.disciplinaAtualId!
    } else {
      if (!e.disciplinaDestinoId) throw invalido('Escolha a disciplina que o colega vai ministrar.')
      const d = buscarDisciplina(tx, e.disciplinaDestinoId)
      if (d.professorId !== e.destinatarioId) throw invalido('A disciplina escolhida não é do colega indicado.')
      const atende = turmasDaDisciplina(tx, d.id)
      if (!grupoA.some((l) => atende.has(l.turmaId))) throw invalido('Trocas só podem acontecer entre professores da mesma turma.')
      if (professorOcupado(tx, e.destinatarioId, a.data, a.horario, [a.grupo]))
        throw conflito(`Choque de horário: ${destinatario.nome} já tem aula em ${curto(a.data, a.horario)}.`)
      disciplinaDestinoId = d.id
    }

    const resumo = {
      ofertada: resumirGrupo(tx, grupoA),
      pedida: grupoB.length ? resumirGrupo(tx, grupoB) : undefined,
      disciplinaDestino: buscarDisciplina(tx, disciplinaDestinoId).nome,
    }
    const p = tx
      .insert(pedido)
      .values({
        tipo: e.tipo,
        solicitanteId: u.id,
        destinatarioId: e.destinatarioId,
        aulaOfertadaId: a.id,
        aulaPedidaId: grupoB[0]?.id ?? null,
        disciplinaDestinoId,
        criadoEm: agora.toISOString(),
        resumo,
      })
      .returning()
      .get()
    travarGrupo(tx, a.grupo, p.id, grupoA.length)
    if (grupoB.length) travarGrupo(tx, grupoB[0].grupo, p.id, grupoB.length)

    const desc =
      e.tipo === 'compensatoria'
        ? `${u.nome} pediu troca compensatória a ${destinatario.nome}: ${resumo.ofertada.turmas.join('/')} ${curto(a.data, a.horario)} ⇄ ${curto(resumo.pedida!.data, resumo.pedida!.horario)}`
        : `${u.nome} ofereceu a ${destinatario.nome} a aula de ${resumo.ofertada.turmas.join('/')} em ${curto(a.data, a.horario)} (troca pontual, ${resumo.disciplinaDestino})`
    registrar(tx, agora, { usuarioId: u.id, tipo: 'pedido_criado', descricao: desc, pedidoId: p.id })
    return p
  })
  ctx.hub.publicar('pedidos', 'aulas')
  return resultado
}

type Acao = 'aprovar' | 'recusar' | 'cancelar'
const STATUS_DA_ACAO = { aprovar: 'aprovado', recusar: 'recusado', cancelar: 'cancelado' } as const

/** RF-08: aprovar (CA-05, CA-06, CA-10), recusar ou cancelar (CA-07) um pedido pendente. */
export function responderPedido(ctx: Contexto, u: Usuario, pedidoId: number, acao: Acao) {
  const resultado = ctx.db.transaction((tx) => {
    const agora = ctx.agora()
    const p = tx.select().from(pedido).where(eq(pedido.id, pedidoId)).get()
    if (!p) throw naoEncontrado('Pedido não encontrado.')
    if (acao === 'cancelar' && p.solicitanteId !== u.id) throw proibido('Só quem fez o pedido pode cancelá-lo.')
    if (acao !== 'cancelar' && p.destinatarioId !== u.id) throw proibido('Só o professor que recebeu o pedido pode respondê-lo.')
    if (p.status !== 'pendente') throw conflito(`Este pedido já foi ${p.status === 'expirado' ? 'expirado' : p.status}.`)

    // Atualização condicional: um segundo clique (ou requisição simultânea) não aplica a troca duas vezes (RN-09).
    const r = tx
      .update(pedido)
      .set({ status: STATUS_DA_ACAO[acao], respondidoEm: agora.toISOString() })
      .where(and(eq(pedido.id, p.id), eq(pedido.status, 'pendente')))
      .run()
    if (r.changes !== 1) throw conflito('Este pedido acabou de ser respondido.')

    const travadas = tx.select().from(aula).where(eq(aula.pedidoPendenteId, p.id)).all()
    const ofertada = buscarAula(tx, p.aulaOfertadaId)
    const grupoA = travadas.filter((l) => l.grupo === ofertada.grupo)
    const grupoB = travadas.filter((l) => l.grupo !== ofertada.grupo)
    let informativo: string[] | undefined

    if (acao === 'aprovar') {
      for (const l of travadas) if (inicioDaAula(l.data, l.horario) <= agora) throw conflito('Uma das aulas já começou; o pedido expirou.')
      if (professorOcupado(tx, p.destinatarioId, ofertada.data, ofertada.horario, [ofertada.grupo, grupoB[0]?.grupo ?? '']))
        throw conflito('Choque de horário: você já tem outra aula nesse horário.')
      if (grupoB.length && professorOcupado(tx, p.solicitanteId, grupoB[0].data, grupoB[0].horario, [ofertada.grupo, grupoB[0].grupo]))
        throw conflito('Choque de horário: quem pediu já tem outra aula nesse horário.')

      const disciplinaA = ofertada.disciplinaAtualId!
      aplicarDisciplina(tx, grupoA, p.disciplinaDestinoId)
      if (p.tipo === 'compensatoria') aplicarDisciplina(tx, grupoB, disciplinaA)
    }

    tx.update(aula).set({ pedidoPendenteId: null }).where(eq(aula.pedidoPendenteId, p.id)).run()

    const n = carregarNomes(tx)
    const solicitante = n.pessoa(p.solicitanteId)
    const destinatario = n.pessoa(p.destinatarioId)
    if (acao === 'aprovar') informativo = gerarInformativo(tx, travadas, aulasPorIds(tx, travadas.map((l) => l.id)))
    const descricoes = {
      aprovar: `${destinatario} aprovou a troca ${p.tipo === 'compensatoria' ? 'compensatória' : 'pontual'} pedida por ${solicitante}`,
      recusar: `${destinatario} recusou o pedido de ${solicitante}`,
      cancelar: `${solicitante} cancelou o pedido feito a ${destinatario}`,
    }
    registrar(tx, agora, {
      usuarioId: u.id,
      tipo: `pedido_${STATUS_DA_ACAO[acao]}` as const,
      descricao: `${descricoes[acao]} (${p.resumo.ofertada.turmas.join('/')} ${curto(p.resumo.ofertada.data, p.resumo.ofertada.horario)})`,
      pedidoId: p.id,
      informativo,
    })
    return { pedido: tx.select().from(pedido).where(eq(pedido.id, p.id)).get()!, informativo }
  })
  ctx.hub.publicar('pedidos', 'aulas')
  return resultado
}

/** RN-07 / CA-16: pedidos pendentes cuja aula já começou passam a expirados e liberam as travas. */
export function expirarPedidos(ctx: Contexto) {
  const agora = ctx.agora()
  const pendentes = ctx.db.select().from(pedido).where(eq(pedido.status, 'pendente')).all()
  let expirados = 0
  for (const p of pendentes) {
    const travadas = ctx.db.select().from(aula).where(eq(aula.pedidoPendenteId, p.id)).all()
    if (travadas.length && !travadas.some((l) => inicioDaAula(l.data, l.horario) <= agora)) continue
    ctx.db.transaction((tx) => {
      const r = tx
        .update(pedido)
        .set({ status: 'expirado', respondidoEm: agora.toISOString() })
        .where(and(eq(pedido.id, p.id), eq(pedido.status, 'pendente')))
        .run()
      if (!r.changes) return
      tx.update(aula).set({ pedidoPendenteId: null }).where(eq(aula.pedidoPendenteId, p.id)).run()
      registrar(tx, agora, {
        tipo: 'pedido_expirado',
        descricao: `Pedido de ${nomeDe(tx, p.solicitanteId)} a ${nomeDe(tx, p.destinatarioId)} expirou sem resposta (a aula começou)`,
        pedidoId: p.id,
      })
      expirados++
    })
  }
  return expirados
}

export interface EntradaReposicao {
  disciplinaId: number
  turmaId: number
  data: string
  horario: number
  sala?: string
}

/** RF-09: reposição em horário vago, sem aprovação (CA-11, CA-12). */
export function reporAula(ctx: Contexto, u: Usuario, e: EntradaReposicao) {
  const resultado = ctx.db.transaction((tx) => {
    const agora = ctx.agora()
    const d = buscarDisciplina(tx, e.disciplinaId)
    if (d.professorId !== u.id) throw proibido('Só o professor da disciplina pode repor aulas dela.')
    if (!turmasDaDisciplina(tx, d.id).has(e.turmaId)) throw invalido('Esta disciplina não é da turma escolhida.')
    const t = tx.select().from(turma).where(eq(turma.id, e.turmaId)).get()
    if (!t) throw naoEncontrado('Turma não encontrada.')
    const sem = tx.select().from(semestre).get()
    if (!sem || e.data < sem.inicio || e.data > sem.fim) throw invalido('A data está fora do semestre.')
    const dia = diaDaSemana(e.data)
    if (dia === 0 || dia === 6) throw invalido('Não há aulas no fim de semana.')
    if (tx.select().from(feriado).where(eq(feriado.data, e.data)).get()) throw conflito('Não é possível repor aula em feriado.')
    if (inicioDaAula(e.data, e.horario) <= agora) throw conflito('Esse horário já começou ou já passou.')
    if (professorOcupado(tx, u.id, e.data, e.horario)) throw conflito('Choque de horário: você já tem aula nesse horário.')

    const existente = tx
      .select()
      .from(aula)
      .where(and(eq(aula.turmaId, e.turmaId), eq(aula.data, e.data), eq(aula.horario, e.horario)))
      .get()
    let id: number
    const antes: Aula[] = []
    if (existente) {
      if (existente.status !== 'vaga' || existente.pedidoPendenteId) throw conflito('Esse horário não está vago nessa turma.')
      antes.push(existente)
      const r = tx
        .update(aula)
        .set({ disciplinaAtualId: d.id, professorAtualId: u.id, status: 'normal', sala: e.sala || existente.sala, grupo: `r|${existente.id}` })
        .where(and(eq(aula.id, existente.id), eq(aula.status, 'vaga'), isNull(aula.pedidoPendenteId)))
        .run()
      if (r.changes !== 1) throw conflito('Esse horário acabou de ser ocupado.')
      id = existente.id
    } else {
      id = tx
        .insert(aula)
        .values({
          turmaId: e.turmaId,
          data: e.data,
          horario: e.horario,
          sala: e.sala ?? '',
          grupo: `r|${e.turmaId}|${e.data}|${e.horario}`,
          disciplinaPrevistaId: null,
          disciplinaAtualId: d.id,
          professorAtualId: u.id,
          status: 'normal',
        })
        .returning({ id: aula.id })
        .get().id
    }
    const informativo = gerarInformativo(tx, antes, aulasPorIds(tx, [id]))
    registrar(tx, agora, {
      usuarioId: u.id,
      tipo: 'reposicao',
      descricao: `${u.nome} registrou reposição de ${d.nome} para ${t.nome} em ${curto(e.data, e.horario)}`,
      informativo,
    })
    return { aulaId: id, informativo }
  })
  ctx.hub.publicar('aulas')
  return resultado
}

/** RF-10 / CA-13: cancelamento com motivo; vira débito no saldo. */
export function cancelarAula(ctx: Contexto, u: Usuario, aulaId: number, motivo: string) {
  const resultado = ctx.db.transaction((tx) => {
    const agora = ctx.agora()
    const a = buscarAula(tx, aulaId)
    if (a.professorAtualId !== u.id) throw proibido('Só o professor desta aula pode cancelá-la.')
    const m = motivo.trim()
    if (m.length < 3) throw invalido('Informe o motivo do cancelamento.')
    const grupo = aulasDoGrupo(tx, a.grupo)
    grupo.forEach((l) => exigirUtilizavel(l, agora))
    const r = tx
      .update(aula)
      .set({ status: 'cancelada', motivo: m })
      .where(and(eq(aula.grupo, a.grupo), eq(aula.status, 'normal'), isNull(aula.pedidoPendenteId)))
      .run()
    if (r.changes !== grupo.length) throw conflito('A aula acabou de ser alterada por outra operação.')
    const informativo = gerarInformativo(tx, grupo, aulasPorIds(tx, grupo.map((l) => l.id)))
    const n = carregarNomes(tx)
    registrar(tx, agora, {
      usuarioId: u.id,
      tipo: 'aula_cancelada',
      descricao: `${u.nome} cancelou a aula de ${n.disciplina(a.disciplinaAtualId)} (${grupo.map((l) => n.turma(l.turmaId)).join('/')}) em ${curto(a.data, a.horario)} — motivo: ${m}`,
      informativo,
    })
    return { informativo }
  })
  ctx.hub.publicar('aulas')
  return resultado
}

