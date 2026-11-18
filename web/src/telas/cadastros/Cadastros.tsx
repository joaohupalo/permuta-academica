import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Papa from 'papaparse'
import { api, del, post, put, ErroApi } from '../../api/cliente'
import { DIAS, dataBR } from '../../api/formato'
import { Abas, Aviso, Botao, Campo, Cartao, Modal, Titulo, classeEntrada, useToast } from '../../componentes/ui'

type Aba = 'semestre' | 'turmas' | 'professores' | 'disciplinas' | 'feriados'

/** Cadastros da coordenação (RF-01, RF-02, RF-03). */
export function Cadastros() {
  const [aba, setAba] = useState<Aba>('semestre')
  return (
    <div>
      <Titulo titulo="Cadastros" subtitulo="Semestre, turmas, professores, disciplinas com horários fixos e feriados." />
      <Abas<Aba>
        abas={[
          { id: 'semestre', rotulo: 'Semestre e calendário' },
          { id: 'turmas', rotulo: 'Turmas' },
          { id: 'professores', rotulo: 'Professores' },
          { id: 'disciplinas', rotulo: 'Disciplinas' },
          { id: 'feriados', rotulo: 'Feriados' },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />
      {aba === 'semestre' && <AbaSemestre />}
      {aba === 'turmas' && (
        <CrudSimples
          recurso="turmas"
          csv={{ tipo: 'turmas', exemplo: 'nome,curso\nSI 2º,SI\nADS 2º,ADS' }}
          colunas={[
            { titulo: 'Turma', valor: (t) => t.nome },
            { titulo: 'Curso', valor: (t) => t.curso },
          ]}
          vazio={{ nome: '', curso: 'SI' }}
          formulario={(v, set) => (
            <>
              <Campo rotulo="Nome">
                <input className={classeEntrada} value={v.nome} onChange={(e) => set({ ...v, nome: e.target.value })} placeholder="SI 4º" />
              </Campo>
              <Campo rotulo="Curso">
                <select className={classeEntrada} value={v.curso} onChange={(e) => set({ ...v, curso: e.target.value })}>
                  <option value="SI">Sistemas de Informação (SI)</option>
                  <option value="ADS">Análise e Desenvolvimento de Sistemas (ADS)</option>
                </select>
              </Campo>
            </>
          )}
        />
      )}
      {aba === 'professores' && (
        <CrudSimples
          recurso="professores"
          csv={{ tipo: 'professores', exemplo: 'nome,email\nAna Souza,ana.souza@unimater.edu' }}
          colunas={[
            { titulo: 'Nome', valor: (p) => p.nome },
            { titulo: 'E-mail', valor: (p) => p.email },
          ]}
          vazio={{ nome: '', email: '', senha: '' }}
          formulario={(v, set) => (
            <>
              <Campo rotulo="Nome">
                <input className={classeEntrada} value={v.nome} onChange={(e) => set({ ...v, nome: e.target.value })} />
              </Campo>
              <Campo rotulo="E-mail institucional">
                <input className={classeEntrada} value={v.email} onChange={(e) => set({ ...v, email: e.target.value })} placeholder="nome@unimater.edu" />
              </Campo>
              <Campo rotulo="Senha" dica="Deixe em branco para usar a senha padrão (123456) ou manter a atual.">
                <input className={classeEntrada} type="password" value={v.senha ?? ''} onChange={(e) => set({ ...v, senha: e.target.value })} />
              </Campo>
            </>
          )}
          limpar={(v) => ({ ...v, senha: v.senha || undefined })}
        />
      )}
      {aba === 'disciplinas' && <AbaDisciplinas />}
      {aba === 'feriados' && (
        <CrudSimples
          recurso="feriados"
          semEditar
          csv={{ tipo: 'feriados', exemplo: 'data,descricao\n20/11/2026,Dia da Consciência Negra' }}
          colunas={[
            { titulo: 'Data', valor: (f) => dataBR(f.data) },
            { titulo: 'Descrição', valor: (f) => f.descricao },
          ]}
          vazio={{ data: '', descricao: '' }}
          formulario={(v, set) => (
            <>
              <Campo rotulo="Data">
                <input type="date" className={classeEntrada} value={v.data} onChange={(e) => set({ ...v, data: e.target.value })} />
              </Campo>
              <Campo rotulo="Descrição">
                <input className={classeEntrada} value={v.descricao} onChange={(e) => set({ ...v, descricao: e.target.value })} />
              </Campo>
            </>
          )}
        />
      )}
    </div>
  )
}

function useSalvar() {
  const qc = useQueryClient()
  const toast = useToast()
  return { qc, toast, invalidar: () => qc.invalidateQueries() }
}

function AbaSemestre() {
  const { toast, invalidar } = useSalvar()
  const { data: sem } = useQuery({ queryKey: ['cadastros', 'semestre'], queryFn: () => api<any>('/semestre') })
  const [form, setForm] = useState<any>(null)
  const v = form ?? sem ?? { nome: '', inicio: '', fim: '' }
  const salvar = useMutation({ mutationFn: () => put('/semestre', { nome: v.nome, inicio: v.inicio, fim: v.fim }), onSuccess: () => (toast('Semestre salvo.', 'sucesso'), setForm(null), invalidar()) })
  const gerar = useMutation({
    mutationFn: async () => {
      try {
        return await post('/semestre/gerar', { substituir: false })
      } catch (e) {
        if (e instanceof ErroApi && e.status === 409 && confirm(`${e.message}\n\nDeseja gerar de novo?`)) return post('/semestre/gerar', { substituir: true })
        throw e
      }
    },
    onSuccess: (r) => r && (toast(`Calendário gerado: ${r.aulas} aulas.`, 'sucesso'), invalidar()),
  })
  return (
    <div className="grid max-w-3xl gap-5">
      <Cartao>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Semestre">
            <input className={classeEntrada} value={v.nome} onChange={(e) => setForm({ ...v, nome: e.target.value })} placeholder="2026/2" />
          </Campo>
          <Campo rotulo="Início">
            <input type="date" className={classeEntrada} value={v.inicio} onChange={(e) => setForm({ ...v, inicio: e.target.value })} />
          </Campo>
          <Campo rotulo="Fim">
            <input type="date" className={classeEntrada} value={v.fim} onChange={(e) => setForm({ ...v, fim: e.target.value })} />
          </Campo>
        </div>
        {salvar.error && <div className="mt-3"><Aviso>{(salvar.error as Error).message}</Aviso></div>}
        <Botao className="mt-4" disabled={!form || salvar.isPending} onClick={() => salvar.mutate()}>
          Salvar semestre
        </Botao>
      </Cartao>
      <Cartao>
        <h3 className="font-medium">Gerar calendário do semestre</h3>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          Cria as aulas de cada turma em cada data do semestre (os dois horários de cada noite), a partir das noites das disciplinas. Datas de feriado já entram marcadas. Gerar de novo apaga as trocas registradas.
        </p>
        {gerar.error && <div className="mb-3"><Aviso>{(gerar.error as Error).message}</Aviso></div>}
        <Botao disabled={gerar.isPending} onClick={() => gerar.mutate()}>
          Gerar calendário
        </Botao>
      </Cartao>
    </div>
  )
}

interface Coluna {
  titulo: string
  valor: (x: any) => ReactNode
}

function CrudSimples({
  recurso,
  colunas,
  vazio,
  formulario,
  csv,
  semEditar,
  limpar = (v) => v,
}: {
  recurso: string
  colunas: Coluna[]
  vazio: any
  formulario: (v: any, set: (v: any) => void) => ReactNode
  csv?: { tipo: string; exemplo: string }
  semEditar?: boolean
  limpar?: (v: any) => any
}) {
  const { toast, invalidar } = useSalvar()
  const { data: itens = [] } = useQuery({ queryKey: ['cadastros', recurso], queryFn: () => api<any[]>(`/${recurso}`) })
  const [edicao, setEdicao] = useState<any>(null)
  const [importando, setImportando] = useState(false)
  const salvar = useMutation({
    mutationFn: () => (edicao.id ? put(`/${recurso}/${edicao.id}`, limpar(edicao)) : post(`/${recurso}`, limpar(edicao))),
    onSuccess: () => (toast('Salvo.', 'sucesso'), setEdicao(null), invalidar()),
  })
  const remover = useMutation({ mutationFn: (id: number) => del(`/${recurso}/${id}`), onSuccess: () => (toast('Removido.', 'sucesso'), invalidar()), onError: (e) => toast((e as Error).message, 'erro') })

  return (
    <Cartao className="!p-0">
      <div className="flex items-center justify-between border-b border-divisa px-5 py-3">
        <span className="text-sm text-slate-500">{itens.length} registro(s)</span>
        <div className="flex gap-2">
          {csv && (
            <Botao variante="secundario" onClick={() => setImportando(true)}>
              Importar CSV
            </Botao>
          )}
          <Botao onClick={() => setEdicao({ ...vazio })}>Adicionar</Botao>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-divisa text-xs text-slate-500">
            {colunas.map((c) => (
              <th key={c.titulo} className="px-5 py-2 text-left font-medium">
                {c.titulo}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {itens.map((x) => (
            <tr key={x.id} className="border-b border-slate-100 last:border-0">
              {colunas.map((c) => (
                <td key={c.titulo} className="px-5 py-2.5">
                  {c.valor(x)}
                </td>
              ))}
              <td className="px-5 text-right whitespace-nowrap">
                {!semEditar && (
                  <button className="mr-3 text-xs font-medium text-marca-600 hover:underline" onClick={() => setEdicao({ ...x, senha: '' })}>
                    Editar
                  </button>
                )}
                <button className="text-xs font-medium text-red-600 hover:underline" onClick={() => confirm('Remover este registro?') && remover.mutate(x.id)}>
                  Remover
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal aberto={!!edicao} aoFechar={() => setEdicao(null)} titulo={edicao?.id ? 'Editar' : 'Adicionar'}>
        {edicao && (
          <div className="space-y-4">
            {formulario(edicao, setEdicao)}
            {salvar.error && <Aviso>{(salvar.error as Error).message}</Aviso>}
            <Botao disabled={salvar.isPending} onClick={() => salvar.mutate()}>
              Salvar
            </Botao>
          </div>
        )}
      </Modal>
      {csv && importando && <ImportarCSV tipo={csv.tipo} exemplo={csv.exemplo} aoFechar={() => setImportando(false)} />}
    </Cartao>
  )
}

/** Importação CSV com prévia: valida no servidor sem gravar, mostra erros por linha e só grava ao confirmar (CA-19). */
function ImportarCSV({ tipo, exemplo, aoFechar }: { tipo: string; exemplo: string; aoFechar: () => void }) {
  const { toast, invalidar } = useSalvar()
  const [linhas, setLinhas] = useState<Record<string, string>[] | null>(null)
  const [previa, setPrevia] = useState<any>(null)
  const [erro, setErro] = useState('')

  const ler = (arquivo: File) => {
    setErro('')
    Papa.parse<Record<string, string>>(arquivo, {
      header: true,
      skipEmptyLines: true,
      complete: async (r) => {
        try {
          setLinhas(r.data)
          setPrevia(await post(`/importar/${tipo}?simular=true`, { linhas: r.data }))
        } catch (e) {
          setErro((e as Error).message)
        }
      },
    })
  }
  const confirmar = useMutation({
    mutationFn: () => post(`/importar/${tipo}`, { linhas }),
    onSuccess: (r) => (toast(`${r.criados} registro(s) importado(s).`, 'sucesso'), invalidar(), aoFechar()),
  })

  return (
    <Modal aberto titulo={`Importar ${tipo} por CSV`} aoFechar={aoFechar} largura="max-w-2xl">
      <p className="mb-2 text-sm text-slate-500">Primeira linha com os nomes das colunas. Exemplo:</p>
      <pre className="mb-4 rounded bg-slate-50 p-3 text-xs">{exemplo}</pre>
      <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && ler(e.target.files[0])} className="mb-4 text-sm" />
      {erro && <Aviso>{erro}</Aviso>}
      {previa && (
        <div className="space-y-3">
          <Aviso tipo={previa.validas ? 'sucesso' : 'info'}>
            {previa.validas} linha(s) válida(s){previa.erros.length ? ` · ${previa.erros.length} com problema` : ''}
          </Aviso>
          {previa.erros.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {previa.erros.map((e: any) => (
                <li key={e.linha}>
                  Linha {e.linha}: {e.erro}
                </li>
              ))}
            </ul>
          )}
          {previa.previa.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded border border-divisa text-xs">
              {previa.previa.map((p: any) => (
                <div key={p.linha} className="border-b border-slate-100 px-3 py-1.5 last:border-0">
                  {Object.values(p.dados).join(' · ')}
                </div>
              ))}
            </div>
          )}
          {confirmar.error && <Aviso>{(confirmar.error as Error).message}</Aviso>}
          <Botao disabled={!previa.validas || confirmar.isPending} onClick={() => confirmar.mutate()}>
            Importar {previa.validas} registro(s)
          </Botao>
        </div>
      )}
    </Modal>
  )
}

function AbaDisciplinas() {
  const { toast, invalidar } = useSalvar()
  const { data: disciplinas = [] } = useQuery({ queryKey: ['cadastros', 'disciplinas'], queryFn: () => api<any[]>('/disciplinas') })
  const { data: professores = [] } = useQuery({ queryKey: ['cadastros', 'professores'], queryFn: () => api<any[]>('/professores') })
  const { data: turmas = [] } = useQuery({ queryKey: ['turmas'], queryFn: () => api<any[]>('/turmas') })
  const [ed, setEd] = useState<any>(null)
  const nomeTurma = (id: number) => turmas.find((t) => t.id === id)?.nome ?? '?'

  const salvar = useMutation({
    mutationFn: () => {
      const corpo = { nome: ed.nome, professorId: Number(ed.professorId), totalAulas: Number(ed.totalAulas), turmaIds: ed.turmaIds, noites: ed.noites }
      return ed.id ? put(`/disciplinas/${ed.id}`, corpo) : post('/disciplinas', corpo)
    },
    onSuccess: () => (toast('Disciplina salva. Gere o calendário de novo para aplicar mudanças de noite.', 'sucesso'), setEd(null), invalidar()),
  })
  const remover = useMutation({ mutationFn: (id: number) => del(`/disciplinas/${id}`), onSuccess: () => (toast('Removida.', 'sucesso'), invalidar()), onError: (e) => toast((e as Error).message, 'erro') })

  return (
    <Cartao className="!p-0">
      <div className="flex items-center justify-between border-b border-divisa px-5 py-3">
        <span className="text-sm text-slate-500">{disciplinas.length} disciplina(s)</span>
        <Botao onClick={() => setEd({ nome: '', professorId: '', totalAulas: 38, turmaIds: [], noites: [{ diaSemana: 1, sala: '' }] })}>Adicionar</Botao>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-divisa text-xs text-slate-500">
            <th className="px-5 py-2 text-left font-medium">Disciplina</th>
            <th className="px-5 py-2 text-left font-medium">Professor</th>
            <th className="px-5 py-2 text-left font-medium">Turmas</th>
            <th className="px-5 py-2 text-left font-medium">Noites</th>
            <th className="px-5 py-2 text-right font-medium">Aulas</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {disciplinas.map((d) => (
            <tr key={d.id} className="border-b border-slate-100 last:border-0">
              <td className="px-5 py-2.5 font-medium">{d.nome}</td>
              <td className="px-5">{d.professor}</td>
              <td className="px-5">{d.turmaIds.map(nomeTurma).join(' + ')}</td>
              <td className="px-5 text-xs text-slate-600">{d.noites.map((h: any) => `${DIAS[h.diaSemana].replace('-feira', '')}${h.sala ? ` (${h.sala})` : ''}`).join(' · ')}</td>
              <td className="px-5 text-right tabular-nums">{d.totalAulas}</td>
              <td className="px-5 text-right whitespace-nowrap">
                <button className="mr-3 text-xs font-medium text-marca-600 hover:underline" onClick={() => setEd({ ...d })}>
                  Editar
                </button>
                <button className="text-xs font-medium text-red-600 hover:underline" onClick={() => confirm('Remover esta disciplina?') && remover.mutate(d.id)}>
                  Remover
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal aberto={!!ed} aoFechar={() => setEd(null)} titulo={ed?.id ? 'Editar disciplina' : 'Nova disciplina'} largura="max-w-2xl">
        {ed && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_200px_110px]">
              <Campo rotulo="Nome">
                <input className={classeEntrada} value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} />
              </Campo>
              <Campo rotulo="Professor">
                <select className={classeEntrada} value={ed.professorId} onChange={(e) => setEd({ ...ed, professorId: e.target.value })}>
                  <option value="">Escolha…</option>
                  {professores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Total de aulas">
                <input type="number" min={1} className={classeEntrada} value={ed.totalAulas} onChange={(e) => setEd({ ...ed, totalAulas: e.target.value })} />
              </Campo>
            </div>
            <Campo rotulo="Turmas" dica="Marque mais de uma para disciplina compartilhada (as turmas assistem juntas).">
              <div className="flex flex-wrap gap-2">
                {turmas.map((t) => (
                  <label key={t.id} className={`cursor-pointer rounded border px-3 py-1.5 text-sm ${ed.turmaIds.includes(t.id) ? 'border-marca-500 bg-marca-50' : 'border-divisa'}`}>
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={ed.turmaIds.includes(t.id)}
                      onChange={(e) => setEd({ ...ed, turmaIds: e.target.checked ? [...ed.turmaIds, t.id] : ed.turmaIds.filter((x: number) => x !== t.id) })}
                    />
                    {t.nome}
                  </label>
                ))}
              </div>
            </Campo>
            <Campo rotulo="Noites" dica="A disciplina ocupa sempre a noite inteira: 1º (19:10–20:25) e 2º (20:45–22:00) horários.">
              <div className="space-y-2">
                {ed.noites.map((h: any, i: number) => {
                  const mudar = (novo: any) => setEd({ ...ed, noites: ed.noites.map((x: any, j: number) => (j === i ? { ...x, ...novo } : x)) })
                  return (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <select className={classeEntrada} value={h.diaSemana} onChange={(e) => mudar({ diaSemana: Number(e.target.value) })}>
                        {[1, 2, 3, 4, 5, 6].map((d) => (
                          <option key={d} value={d}>
                            {DIAS[d]}
                          </option>
                        ))}
                      </select>
                      <input className={classeEntrada} placeholder="Sala" value={h.sala} onChange={(e) => mudar({ sala: e.target.value })} />
                      <Botao variante="fantasma" onClick={() => setEd({ ...ed, noites: ed.noites.filter((_: any, j: number) => j !== i) })}>
                        ✕
                      </Botao>
                    </div>
                  )
                })}
                <Botao variante="secundario" onClick={() => setEd({ ...ed, noites: [...ed.noites, { diaSemana: 1, sala: '' }] })}>
                  + noite
                </Botao>
              </div>
            </Campo>
            {salvar.error && <Aviso>{(salvar.error as Error).message}</Aviso>}
            <Botao disabled={salvar.isPending} onClick={() => salvar.mutate()}>
              Salvar disciplina
            </Botao>
          </div>
        )}
      </Modal>
    </Cartao>
  )
}
