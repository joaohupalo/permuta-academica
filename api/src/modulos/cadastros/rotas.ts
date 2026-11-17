import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { and, eq, ne, or } from 'drizzle-orm'
import { z } from 'zod'
import type { Contexto, Tx } from '../../contexto.js'
import { aula, disciplina, disciplinaTurma, feriado, horarioFixo, semestre, turma, usuario } from '../../db/schema.js'
import { conflito, invalido, naoEncontrado } from '../../compartilhado/erros.js'
import { NOMES_DIAS } from '../../compartilhado/horarios.js'
import { autenticar, somenteAdmin } from '../auth/guardas.js'
import { registrar } from '../historico/registrar.js'
import { desmarcarFeriado, gerarCalendario, marcarFeriado } from '../calendario/gerar.js'

const SENHA_PADRAO = '123456'
const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato AAAA-MM-DD')
const id = z.coerce.number().int().positive()
const params = z.object({ id })

const esquemas = {
  semestre: z.object({ nome: z.string().trim().min(1), inicio: dataISO, fim: dataISO }),
  turma: z.object({ nome: z.string().trim().min(1, 'informe o nome'), curso: z.enum(['SI', 'ADS']) }),
  professor: z.object({
    nome: z.string().trim().min(1, 'informe o nome'),
    email: z.string().trim().toLowerCase().email('e-mail inválido'),
    senha: z.string().min(4).optional(),
  }),
  disciplina: z.object({
    nome: z.string().trim().min(1, 'informe o nome'),
    professorId: id,
    totalAulas: z.coerce.number().int().min(1),
    turmaIds: z.array(id).min(1, 'escolha ao menos uma turma'),
    horarios: z
      .array(z.object({ diaSemana: z.number().int().min(1).max(6), horario: z.union([z.literal(1), z.literal(2)]), sala: z.string().trim().default('') }))
      .min(1, 'informe ao menos um horário fixo'),
  }),
  feriado: z.object({ data: dataISO, descricao: z.string().trim().min(1, 'informe a descrição') }),
}

/** Aceita AAAA-MM-DD ou DD/MM/AAAA (formato comum em planilhas). */
function normalizarData(valor: string) {
  const v = valor.trim()
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return br ? `${br[3]}-${br[2]}-${br[1]}` : v
}

/** Choque na grade fixa: a turma ou o professor já ocupados nesse dia e horário por outra disciplina. */
function validarGrade(tx: Tx, dados: z.infer<typeof esquemas.disciplina>, ignorarId?: number) {
  const chaves = new Set<string>()
  for (const h of dados.horarios) {
    const k = `${h.diaSemana}|${h.horario}`
    if (chaves.has(k)) throw invalido('Há horários fixos repetidos.')
    chaves.add(k)
  }
  const outras = tx
    .select({ id: disciplina.id, nome: disciplina.nome, professorId: disciplina.professorId, diaSemana: horarioFixo.diaSemana, horario: horarioFixo.horario, turmaId: disciplinaTurma.turmaId })
    .from(disciplina)
    .innerJoin(horarioFixo, eq(horarioFixo.disciplinaId, disciplina.id))
    .innerJoin(disciplinaTurma, eq(disciplinaTurma.disciplinaId, disciplina.id))
    .where(ignorarId ? ne(disciplina.id, ignorarId) : undefined)
    .all()
  for (const o of outras) {
    if (!chaves.has(`${o.diaSemana}|${o.horario}`)) continue
    const quando = `${NOMES_DIAS[o.diaSemana]}, ${o.horario}º horário`
    if (dados.turmaIds.includes(o.turmaId)) throw conflito(`A turma já tem ${o.nome} em ${quando}.`)
    if (o.professorId === dados.professorId) throw conflito(`O professor já leciona ${o.nome} em ${quando}.`)
  }
}

function salvarDisciplina(tx: Tx, dados: z.infer<typeof esquemas.disciplina>, existenteId?: number) {
  validarGrade(tx, dados, existenteId)
  const valores = { nome: dados.nome, professorId: dados.professorId, totalAulas: dados.totalAulas }
  const discId = existenteId
    ? (tx.update(disciplina).set(valores).where(eq(disciplina.id, existenteId)).run(), existenteId)
    : tx.insert(disciplina).values(valores).returning({ id: disciplina.id }).get().id
  tx.delete(disciplinaTurma).where(eq(disciplinaTurma.disciplinaId, discId)).run()
  tx.delete(horarioFixo).where(eq(horarioFixo.disciplinaId, discId)).run()
  tx.insert(disciplinaTurma).values(dados.turmaIds.map((turmaId) => ({ disciplinaId: discId, turmaId }))).run()
  tx.insert(horarioFixo).values(dados.horarios.map((h) => ({ ...h, disciplinaId: discId }))).run()
  return discId
}

export function rotasCadastros(app: FastifyInstance, ctx: Contexto) {
  const { db, hub } = ctx
  const ler = { preHandler: autenticar }
  const admin = { preHandler: somenteAdmin }

  /** Executa a alteração numa transação, registra no histórico e avisa as telas. */
  function alterar<T>(usuarioId: number, descricao: string, fn: (tx: Tx) => T): T {
    const r = db.transaction((tx) => {
      const resultado = fn(tx)
      registrar(tx, ctx.agora(), { usuarioId, tipo: 'cadastro', descricao })
      return resultado
    })
    hub.publicar('cadastros', 'aulas')
    return r
  }

  // ── Semestre e calendário ──
  app.get('/semestre', ler, async () => db.select().from(semestre).get() ?? null)

  app.put('/semestre', admin, async (req) => {
    const dados = esquemas.semestre.parse(req.body)
    if (dados.inicio > dados.fim) throw invalido('O início deve ser antes do fim.')
    return alterar(req.user.id, `Semestre ${dados.nome} definido (${dados.inicio} a ${dados.fim})`, (tx) => {
      const atual = tx.select().from(semestre).get()
      if (atual) tx.update(semestre).set(dados).where(eq(semestre.id, atual.id)).run()
      else tx.insert(semestre).values(dados).run()
      return tx.select().from(semestre).get()
    })
  })

  app.post('/semestre/gerar', admin, async (req) => {
    const { substituir } = z.object({ substituir: z.boolean().default(false) }).parse(req.body ?? {})
    const r = db.transaction((tx) => {
      const res = gerarCalendario(tx, { substituir })
      registrar(tx, ctx.agora(), { usuarioId: req.user.id, tipo: 'calendario_gerado', descricao: `Calendário do semestre gerado: ${res.aulas} aulas` })
      return res
    })
    hub.publicar('aulas', 'pedidos')
    return r
  })

  // ── Turmas ──
  app.get('/turmas', ler, async () => db.select().from(turma).orderBy(turma.curso, turma.nome).all())
  app.post('/turmas', admin, async (req, res) => {
    const dados = esquemas.turma.parse(req.body)
    return res.status(201).send(alterar(req.user.id, `Turma ${dados.nome} cadastrada`, (tx) => tx.insert(turma).values(dados).returning().get()))
  })
  app.put('/turmas/:id', admin, async (req) => {
    const { id: tid } = params.parse(req.params)
    const dados = esquemas.turma.parse(req.body)
    return alterar(req.user.id, `Turma ${dados.nome} alterada`, (tx) => tx.update(turma).set(dados).where(eq(turma.id, tid)).returning().get())
  })
  app.delete('/turmas/:id', admin, async (req) => {
    const { id: tid } = params.parse(req.params)
    const t = db.select().from(turma).where(eq(turma.id, tid)).get()
    if (!t) throw naoEncontrado()
    if (db.select({ id: aula.id }).from(aula).where(eq(aula.turmaId, tid)).limit(1).get())
      throw conflito('A turma já tem aulas no calendário. Remova as disciplinas dela e gere o calendário de novo.')
    return alterar(req.user.id, `Turma ${t.nome} removida`, (tx) => (tx.delete(turma).where(eq(turma.id, tid)).run(), { ok: true }))
  })

  // ── Professores ──
  const colunasProfessor = { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel }
  app.get('/professores', ler, async () => db.select(colunasProfessor).from(usuario).where(eq(usuario.papel, 'professor')).orderBy(usuario.nome).all())
  app.post('/professores', admin, async (req, res) => {
    const dados = esquemas.professor.parse(req.body)
    return res.status(201).send(
      alterar(req.user.id, `Professor(a) ${dados.nome} cadastrado(a)`, (tx) =>
        tx
          .insert(usuario)
          .values({ nome: dados.nome, email: dados.email, senhaHash: bcrypt.hashSync(dados.senha ?? SENHA_PADRAO, 8), papel: 'professor' })
          .returning(colunasProfessor)
          .get(),
      ),
    )
  })
  app.put('/professores/:id', admin, async (req) => {
    const { id: pid } = params.parse(req.params)
    const dados = esquemas.professor.parse(req.body)
    return alterar(req.user.id, `Professor(a) ${dados.nome} alterado(a)`, (tx) =>
      tx
        .update(usuario)
        .set({ nome: dados.nome, email: dados.email, ...(dados.senha ? { senhaHash: bcrypt.hashSync(dados.senha, 8) } : {}) })
        .where(and(eq(usuario.id, pid), eq(usuario.papel, 'professor')))
        .returning(colunasProfessor)
        .get(),
    )
  })
  app.delete('/professores/:id', admin, async (req) => {
    const { id: pid } = params.parse(req.params)
    const p = db.select().from(usuario).where(and(eq(usuario.id, pid), eq(usuario.papel, 'professor'))).get()
    if (!p) throw naoEncontrado()
    if (db.select({ id: disciplina.id }).from(disciplina).where(eq(disciplina.professorId, pid)).limit(1).get())
      throw conflito('O professor tem disciplinas cadastradas. Transfira ou remova as disciplinas antes.')
    return alterar(req.user.id, `Professor(a) ${p.nome} removido(a)`, (tx) => (tx.delete(usuario).where(eq(usuario.id, pid)).run(), { ok: true }))
  })

  // ── Disciplinas ──
  app.get('/disciplinas', ler, async () => {
    const ds = db.select({ d: disciplina, professor: usuario.nome }).from(disciplina).innerJoin(usuario, eq(usuario.id, disciplina.professorId)).orderBy(disciplina.nome).all()
    const turmas = db.select().from(disciplinaTurma).all()
    const horarios = db.select().from(horarioFixo).orderBy(horarioFixo.diaSemana, horarioFixo.horario).all()
    return ds.map(({ d, professor }) => ({
      ...d,
      professor,
      turmaIds: turmas.filter((t) => t.disciplinaId === d.id).map((t) => t.turmaId),
      horarios: horarios.filter((h) => h.disciplinaId === d.id).map(({ diaSemana, horario, sala }) => ({ diaSemana, horario, sala })),
    }))
  })
  app.post('/disciplinas', admin, async (req, res) => {
    const dados = esquemas.disciplina.parse(req.body)
    return res.status(201).send(alterar(req.user.id, `Disciplina ${dados.nome} cadastrada`, (tx) => ({ id: salvarDisciplina(tx, dados) })))
  })
  app.put('/disciplinas/:id', admin, async (req) => {
    const { id: did } = params.parse(req.params)
    if (!db.select().from(disciplina).where(eq(disciplina.id, did)).get()) throw naoEncontrado()
    const dados = esquemas.disciplina.parse(req.body)
    return alterar(req.user.id, `Disciplina ${dados.nome} alterada`, (tx) => ({ id: salvarDisciplina(tx, dados, did) }))
  })
  app.delete('/disciplinas/:id', admin, async (req) => {
    const { id: did } = params.parse(req.params)
    const d = db.select().from(disciplina).where(eq(disciplina.id, did)).get()
    if (!d) throw naoEncontrado()
    if (db.select({ id: aula.id }).from(aula).where(or(eq(aula.disciplinaPrevistaId, did), eq(aula.disciplinaAtualId, did))).limit(1).get())
      throw conflito('A disciplina já tem aulas no calendário. Gere o calendário de novo antes de removê-la.')
    return alterar(req.user.id, `Disciplina ${d.nome} removida`, (tx) => (tx.delete(disciplina).where(eq(disciplina.id, did)).run(), { ok: true }))
  })

  // ── Feriados ──
  app.get('/feriados', ler, async () => db.select().from(feriado).orderBy(feriado.data).all())
  app.post('/feriados', admin, async (req, res) => {
    const dados = esquemas.feriado.parse(req.body)
    return res.status(201).send(
      alterar(req.user.id, `Feriado ${dados.descricao} (${dados.data}) cadastrado`, (tx) => {
        const f = tx.insert(feriado).values(dados).returning().get()
        return { ...f, aulasAfetadas: marcarFeriado(tx, dados.data) }
      }),
    )
  })
  app.delete('/feriados/:id', admin, async (req) => {
    const { id: fid } = params.parse(req.params)
    const f = db.select().from(feriado).where(eq(feriado.id, fid)).get()
    if (!f) throw naoEncontrado()
    return alterar(req.user.id, `Feriado ${f.descricao} (${f.data}) removido`, (tx) => {
      tx.delete(feriado).where(eq(feriado.id, fid)).run()
      return { ok: true, aulasAfetadas: desmarcarFeriado(tx, f.data) }
    })
  })

  // ── Importação CSV (RF-02, CA-19) ──
  app.post('/importar/:tipo', admin, async (req) => {
    const { tipo } = z.object({ tipo: z.enum(['professores', 'turmas', 'feriados']) }).parse(req.params)
    const { simular } = z.object({ simular: z.coerce.boolean().default(false) }).parse(req.query)
    const { linhas } = z.object({ linhas: z.array(z.record(z.string(), z.string())).max(1000) }).parse(req.body)

    const erros: { linha: number; erro: string }[] = []
    const validas: { linha: number; dados: any }[] = []
    const vistos = new Set<string>()
    const existentes = {
      professores: new Set(db.select({ v: usuario.email }).from(usuario).all().map((x) => x.v)),
      turmas: new Set(db.select({ v: turma.nome }).from(turma).all().map((x) => x.v)),
      feriados: new Set(db.select({ v: feriado.data }).from(feriado).all().map((x) => x.v)),
    }[tipo]

    linhas.forEach((bruta, i) => {
      const linha = i + 2 // linha 1 do arquivo é o cabeçalho
      const l = Object.fromEntries(Object.entries(bruta).map(([k, v]) => [k.trim().toLowerCase(), (v ?? '').trim()]))
      const r =
        tipo === 'professores'
          ? esquemas.professor.safeParse({ nome: l.nome, email: l.email })
          : tipo === 'turmas'
            ? esquemas.turma.safeParse({ nome: l.nome, curso: (l.curso ?? '').toUpperCase() })
            : esquemas.feriado.safeParse({ data: normalizarData(l.data ?? ''), descricao: l.descricao })
      if (!r.success) {
        const p = r.error.issues[0]
        return erros.push({ linha, erro: `${p.path.join('.') || 'linha'}: ${p.message}` })
      }
      const chave = tipo === 'professores' ? (r.data as any).email : tipo === 'turmas' ? (r.data as any).nome : (r.data as any).data
      if (existentes.has(chave)) return erros.push({ linha, erro: `"${chave}" já está cadastrado` })
      if (vistos.has(chave)) return erros.push({ linha, erro: `"${chave}" aparece repetido no arquivo` })
      vistos.add(chave)
      validas.push({ linha, dados: r.data })
    })

    if (!simular && validas.length) {
      alterar(req.user.id, `Importação CSV de ${tipo}: ${validas.length} registro(s)`, (tx) => {
        for (const { dados } of validas) {
          if (tipo === 'professores')
            tx.insert(usuario).values({ nome: dados.nome, email: dados.email, senhaHash: bcrypt.hashSync(SENHA_PADRAO, 8), papel: 'professor' }).run()
          else if (tipo === 'turmas') tx.insert(turma).values(dados).run()
          else {
            tx.insert(feriado).values(dados).run()
            marcarFeriado(tx, dados.data)
          }
        }
      })
    }
    return { simulacao: simular, validas: validas.length, criados: simular ? 0 : validas.length, erros, previa: validas.slice(0, 50) }
  })
}

