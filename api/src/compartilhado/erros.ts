/** Erro de regra de negócio: vira uma resposta HTTP com mensagem legível. */
export class ErroRegra extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem)
  }
}

export const invalido = (msg: string) => new ErroRegra(400, msg)
export const proibido = (msg = 'Você não tem permissão para esta operação.') => new ErroRegra(403, msg)
export const naoEncontrado = (msg = 'Registro não encontrado.') => new ErroRegra(404, msg)
export const conflito = (msg: string) => new ErroRegra(409, msg)
