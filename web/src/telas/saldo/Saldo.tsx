import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/cliente'
import { useSessao } from '../../api/sessao'
import { dataHora } from '../../api/formato'
import { Cartao, Etiqueta, Titulo, classeEntrada } from '../../componentes/ui'
import { ModalInformativo } from '../../componentes/Informativo'

const COR_EVENTO: Record<string, string> = {
  pedido_criado: 'bg-amber-400',
  pedido_aprovado: 'bg-emerald-500',
  pedido_recusado: 'bg-red-400',
  pedido_cancelado: 'bg-slate-400',
  pedido_expirado: 'bg-slate-400',
  reposicao: 'bg-teal-500',
  aula_cancelada: 'bg-red-500',
  calendario_gerado: 'bg-marca-500',
  cadastro: 'bg-marca-300',
}

/** Saldo de aulas por disciplina e turma (RF-12) e histórico auditável (RF-13). Todos veem tudo. */
export function Saldo() {
  const { usuario } = useSessao()
  const [professorId, setProfessorId] = useState(usuario!.papel === 'professor' ? String(usuario!.id) : '')
  const [turmaId, setTurmaId] = useState('')
  const [informativo, setInformativo] = useState<string[] | null>(null)

  const { data: professores = [] } = useQuery({ queryKey: ['cadastros', 'professores'], queryFn: () => api<any[]>('/professores') })
  const { data: turmas = [] } = useQuery({ queryKey: ['turmas'], queryFn: () => api<any[]>('/turmas') })
  const { data: linhas = [] } = useQuery({
    queryKey: ['saldo', professorId, turmaId],
    queryFn: () => api<any[]>(`/saldo?${professorId ? `professorId=${professorId}&` : ''}${turmaId ? `turmaId=${turmaId}` : ''}`),
  })
  const { data: historico = [] } = useQuery({ queryKey: ['historico'], queryFn: () => api<any[]>('/historico?limite=150') })

  const soma = (k: string) => linhas.reduce((s, l) => s + l[k], 0)
  const saldoTotal = soma('saldo')
  const indicadores = [
    { rotulo: 'Previstas', valor: soma('previstas'), dica: 'no semestre' },
    { rotulo: 'Ministradas', valor: soma('ministradas'), dica: 'até agora' },
    { rotulo: 'Cedidas', valor: soma('cedidas'), dica: 'débito a repor', cor: 'text-amber-600' },
    { rotulo: 'Assumidas', valor: soma('assumidas'), dica: 'crédito', cor: 'text-emerald-600' },
    { rotulo: 'Canceladas', valor: soma('canceladas'), dica: 'débito a repor', cor: 'text-red-600' },
    { rotulo: 'Saldo', valor: saldoTotal > 0 ? `+${saldoTotal}` : saldoTotal, dica: saldoTotal < 0 ? 'aulas a repor' : saldoTotal > 0 ? 'crédito' : 'em dia', cor: saldoTotal < 0 ? 'text-red-600' : saldoTotal > 0 ? 'text-emerald-600' : 'text-texto' },
  ]

  return (
    <div>
      <Titulo
        titulo="Saldo de aulas e histórico"
        subtitulo="Calculado automaticamente a partir das aulas: cada troca aprovada, aula concluída ou cancelada já entra aqui."
        acoes={
          <div className="flex gap-2">
            <select className={`${classeEntrada} !w-56`} value={professorId} onChange={(e) => setProfessorId(e.target.value)}>
              <option value="">Todos os professores</option>
              {professores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <select className={`${classeEntrada} !w-40`} value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              <option value="">Todas as turmas</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {indicadores.map((i) => (
          <Cartao key={i.rotulo} className="!p-4">
            <div className="text-xs font-medium uppercase text-slate-500">{i.rotulo}</div>
            <div className={`mt-1 text-3xl font-medium ${i.cor ?? 'text-texto'}`}>{i.valor}</div>
            <div className="text-xs text-slate-400">{i.dica}</div>
          </Cartao>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Cartao className="overflow-x-auto !p-0">
          <div className="px-5 pt-4 pb-2 text-xs font-medium uppercase text-slate-500">Por disciplina e turma</div>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-divisa">
                <th className="px-5 py-2 text-left font-medium">Disciplina</th>
                <th className="px-2 py-2 text-right font-medium" title="Previstas">Prev.</th>
                <th className="px-2 py-2 text-right font-medium" title="Ministradas">Min.</th>
                <th className="px-2 py-2 text-right font-medium" title="Cedidas">Ced.</th>
                <th className="px-2 py-2 text-right font-medium" title="Assumidas">Ass.</th>
                <th className="px-2 py-2 text-right font-medium" title="Canceladas">Canc.</th>
                <th className="px-2 py-2 text-right font-medium">Saldo</th>
                <th className="px-5 py-2 text-left font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={`${l.disciplinaId}|${l.turmaId}`} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-2.5">
                    <div className="font-medium text-texto">{l.disciplina}</div>
                    <div className="text-xs text-slate-500">
                      {l.turma} · {l.professor}
                    </div>
                  </td>
                  <td className="px-2 text-right tabular-nums">{l.previstas}</td>
                  <td className="px-2 text-right tabular-nums">{l.ministradas}</td>
                  <td className="px-2 text-right tabular-nums">{l.cedidas}</td>
                  <td className="px-2 text-right tabular-nums">{l.assumidas}</td>
                  <td className="px-2 text-right tabular-nums">{l.canceladas}</td>
                  <td className={`px-2 text-right font-medium tabular-nums ${l.saldo < 0 ? 'text-red-600' : l.saldo > 0 ? 'text-emerald-600' : ''}`}>
                    {l.saldo > 0 ? `+${l.saldo}` : l.saldo}
                  </td>
                  <td className="px-5">
                    <Etiqueta cor={l.situacao === 'a repor' ? 'vermelho' : l.situacao === 'crédito' ? 'verde' : 'cinza'}>
                      {l.situacao === 'a repor' ? `${-l.saldo} a repor` : l.situacao === 'crédito' ? 'Crédito' : 'Em dia'}
                    </Etiqueta>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>

        <Cartao className="max-h-[70vh] overflow-y-auto">
          <div className="mb-3 text-xs font-medium uppercase text-slate-500">Histórico de alterações</div>
          <ol className="relative space-y-4 border-l border-divisa pl-5">
            {historico.map((e) => (
              <li key={e.id} className="relative">
                <span className={`absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full ring-4 ring-white ${COR_EVENTO[e.tipo] ?? 'bg-slate-400'}`} />
                <div className="text-sm text-texto">{e.descricao}</div>
                <div className="text-xs text-slate-400">
                  {dataHora(e.quando)}
                  {e.dados?.informativo?.length > 0 && (
                    <button className="ml-2 font-medium text-marca-600 hover:underline" onClick={() => setInformativo(e.dados.informativo)}>
                      informativo
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Cartao>
      </div>
      <ModalInformativo textos={informativo} aoFechar={() => setInformativo(null)} />
    </div>
  )
}
