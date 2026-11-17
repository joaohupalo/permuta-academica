import { sqliteTable, integer, text, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

export const usuario = sqliteTable('usuario', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  senhaHash: text('senha_hash').notNull(),
  papel: text('papel', { enum: ['admin', 'professor'] }).notNull().default('professor'),
})

export const semestre = sqliteTable('semestre', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nome: text('nome').notNull(),
  inicio: text('inicio').notNull(), // AAAA-MM-DD
  fim: text('fim').notNull(),
})

export const turma = sqliteTable('turma', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nome: text('nome').notNull().unique(),
  curso: text('curso', { enum: ['SI', 'ADS'] }).notNull(),
})

export const disciplina = sqliteTable('disciplina', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nome: text('nome').notNull(),
  professorId: integer('professor_id').notNull().references(() => usuario.id),
  totalAulas: integer('total_aulas').notNull(),
})

export const disciplinaTurma = sqliteTable(
  'disciplina_turma',
  {
    disciplinaId: integer('disciplina_id').notNull().references(() => disciplina.id, { onDelete: 'cascade' }),
    turmaId: integer('turma_id').notNull().references(() => turma.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.disciplinaId, t.turmaId] })],
)

export const horarioFixo = sqliteTable('horario_fixo', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  disciplinaId: integer('disciplina_id').notNull().references(() => disciplina.id, { onDelete: 'cascade' }),
  diaSemana: integer('dia_semana').notNull(), // 1 = segunda ... 6 = sábado
  horario: integer('horario').notNull(), // 1 = 19:10–20:25, 2 = 20:45–22:00
  sala: text('sala').notNull().default(''),
})

export const feriado = sqliteTable('feriado', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  data: text('data').notNull().unique(),
  descricao: text('descricao').notNull(),
})

export const STATUS_AULA = ['normal', 'feriado', 'cancelada', 'vaga'] as const
export type StatusAula = (typeof STATUS_AULA)[number]

export const aula = sqliteTable(
  'aula',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    turmaId: integer('turma_id').notNull().references(() => turma.id, { onDelete: 'cascade' }),
    data: text('data').notNull(),
    horario: integer('horario').notNull(),
    sala: text('sala').notNull().default(''),
    grupo: text('grupo').notNull(),
    disciplinaPrevistaId: integer('disciplina_prevista_id').references(() => disciplina.id, { onDelete: 'set null' }),
    disciplinaAtualId: integer('disciplina_atual_id').references(() => disciplina.id, { onDelete: 'set null' }),
    professorAtualId: integer('professor_atual_id').references(() => usuario.id, { onDelete: 'set null' }),
    status: text('status', { enum: STATUS_AULA }).notNull().default('normal'),
    motivo: text('motivo'),
    pedidoPendenteId: integer('pedido_pendente_id'),
  },
  (t) => [
    uniqueIndex('aula_turma_data_horario').on(t.turmaId, t.data, t.horario),
    index('aula_grupo').on(t.grupo),
    index('aula_data').on(t.data),
  ],
)

export const STATUS_PEDIDO = ['pendente', 'aprovado', 'recusado', 'cancelado', 'expirado'] as const
export type StatusPedido = (typeof STATUS_PEDIDO)[number]

export const pedido = sqliteTable('pedido', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tipo: text('tipo', { enum: ['compensatoria', 'pontual'] }).notNull(),
  solicitanteId: integer('solicitante_id').notNull().references(() => usuario.id),
  destinatarioId: integer('destinatario_id').notNull().references(() => usuario.id),
  aulaOfertadaId: integer('aula_ofertada_id').notNull().references(() => aula.id),
  aulaPedidaId: integer('aula_pedida_id').references(() => aula.id),
  disciplinaDestinoId: integer('disciplina_destino_id').notNull().references(() => disciplina.id),
  status: text('status', { enum: STATUS_PEDIDO }).notNull().default('pendente'),
  criadoEm: text('criado_em').notNull(),
  respondidoEm: text('respondido_em'),
})

export const evento = sqliteTable('evento', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  quando: text('quando').notNull(),
  usuarioId: integer('usuario_id').references(() => usuario.id, { onDelete: 'set null' }),
  tipo: text('tipo').notNull(),
  descricao: text('descricao').notNull(),
  pedidoId: integer('pedido_id'),
  dados: text('dados', { mode: 'json' }).$type<{ informativo?: string[] } & Record<string, unknown>>(),
})
