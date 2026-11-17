import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroRegra } from '../../compartilhado/erros.js'

export interface UsuarioToken {
  id: number
  nome: string
  papel: 'admin' | 'professor'
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: UsuarioToken
    user: UsuarioToken
  }
}

/** Exige login (CA-20). */
export async function autenticar(req: FastifyRequest, _res: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    throw new ErroRegra(401, 'Faça login para continuar.')
  }
}

/** Exige perfil de coordenação. */
export async function somenteAdmin(req: FastifyRequest, res: FastifyReply) {
  await autenticar(req, res)
  if (req.user.papel !== 'admin') throw new ErroRegra(403, 'Apenas a coordenação pode fazer isso.')
}
