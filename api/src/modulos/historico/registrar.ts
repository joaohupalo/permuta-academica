import type { Tx } from '../../contexto.js'
import { evento } from '../../db/schema.js'

export type TipoEvento =
  | 'calendario_gerado'
  | 'pedido_criado'
  | 'pedido_aprovado'
  | 'pedido_recusado'
  | 'pedido_cancelado'
  | 'pedido_expirado'
  | 'reposicao'
  | 'aula_cancelada'
  | 'cadastro'

/** Histórico auditável (RF-13): só recebe inserções, nunca é editado ou apagado. */
export function registrar(
  tx: Tx,
  agora: Date,
  e: { usuarioId?: number | null; tipo: TipoEvento; descricao: string; pedidoId?: number; informativo?: string[] },
) {
  return tx
    .insert(evento)
    .values({
      quando: agora.toISOString(),
      usuarioId: e.usuarioId ?? null,
      tipo: e.tipo,
      descricao: e.descricao,
      pedidoId: e.pedidoId ?? null,
      dados: e.informativo ? { informativo: e.informativo } : null,
    })
    .returning({ id: evento.id })
    .get()
}
