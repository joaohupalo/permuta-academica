import type { ServerResponse } from 'node:http'

/** Canais de aviso: o front recarrega as consultas ligadas a cada canal. */
export type Canal = 'aulas' | 'pedidos' | 'cadastros'

/**
 * Central de avisos em tempo real (SSE).
 * O aviso não carrega dados: só diz "isto mudou", e cada tela busca de novo na API.
 */
export class Hub {
  private clientes = new Set<ServerResponse>()
  private ouvintes = new Set<(canais: Canal[]) => void>()

  conectar(res: ServerResponse) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.write('retry: 3000\n\n')
    this.clientes.add(res)
    const batida = setInterval(() => res.write(': ping\n\n'), 25000)
    res.on('close', () => {
      clearInterval(batida)
      this.clientes.delete(res)
    })
  }

  publicar(...canais: Canal[]) {
    const msg = `data: ${JSON.stringify({ canais })}\n\n`
    for (const c of this.clientes) c.write(msg)
    for (const o of this.ouvintes) o(canais)
  }

  /** Usado nos testes para verificar que um aviso foi publicado. */
  ouvir(fn: (canais: Canal[]) => void) {
    this.ouvintes.add(fn)
    return () => this.ouvintes.delete(fn)
  }

  get conectados() {
    return this.clientes.size
  }
}
