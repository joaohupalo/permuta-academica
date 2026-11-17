import { useState } from 'react'
import { Botao, Modal } from './ui'

/** Informativo para os alunos (RF-15): um texto por turma, com Copiar e Compartilhar no WhatsApp. */
export function ModalInformativo({ textos, aoFechar }: { textos: string[] | null; aoFechar: () => void }) {
  const [copiado, setCopiado] = useState<number | null>(null)
  if (!textos) return null
  const copiar = async (texto: string, i: number) => {
    await navigator.clipboard.writeText(texto)
    setCopiado(i)
    setTimeout(() => setCopiado(null), 2000)
  }
  return (
    <Modal aberto titulo="Informativo para os alunos" aoFechar={aoFechar} largura="max-w-2xl">
      <p className="mb-4 text-sm text-slate-500">Envie no grupo da turma. O texto já está formatado para o WhatsApp.</p>
      <div className="space-y-4">
        {textos.map((texto, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <pre className="font-sans text-sm whitespace-pre-wrap text-slate-800">{texto}</pre>
            <div className="mt-3 flex gap-2">
              <Botao variante="secundario" onClick={() => copiar(texto, i)}>
                {copiado === i ? 'Copiado!' : 'Copiar texto'}
              </Botao>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-medium text-white hover:brightness-95"
              >
                Compartilhar no WhatsApp
              </a>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
