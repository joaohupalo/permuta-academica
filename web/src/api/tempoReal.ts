import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Conexão única com /api/eventos (SSE). A API só avisa "algo mudou";
 * aqui invalidamos as consultas e o TanStack Query busca os dados de novo (RF-18).
 */
export function useTempoReal(aoReceber?: (canais: string[]) => void) {
  const qc = useQueryClient()
  const [conectado, setConectado] = useState(false)
  useEffect(() => {
    const fonte = new EventSource('/api/eventos')
    fonte.onopen = () => setConectado(true)
    fonte.onerror = () => setConectado(false)
    fonte.onmessage = (e) => {
      const { canais } = JSON.parse(e.data) as { canais: string[] }
      qc.invalidateQueries()
      aoReceber?.(canais)
    }
    return () => fonte.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc])
  return conectado
}
