import type { Banco } from './db/conexao.js'
import type { Hub } from './modulos/eventos/hub.js'

/** O que todos os módulos recebem: banco, relógio e canal de avisos em tempo real. */
export interface Contexto {
  db: Banco
  agora: () => Date
  hub: Hub
}

/** Transação ou banco: os serviços aceitam os dois. */
export type Tx = Parameters<Parameters<Banco['transaction']>[0]>[0] | Banco
