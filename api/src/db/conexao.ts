import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import * as schema from './schema.js'

export type Banco = BetterSQLite3Database<typeof schema>

const pastaMigracoes = fileURLToPath(new URL('./migracoes', import.meta.url))

/** Abre o banco (arquivo ou ':memory:') e aplica as migrações pendentes. */
export function abrirBanco(arquivo: string): Banco {
  const sqlite = new Database(arquivo)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: pastaMigracoes })
  return db
}
