import { Navigate, Route, Routes } from 'react-router-dom'
import { useSessao } from './api/sessao'
import { Layout } from './componentes/Layout'
import { ToastProvider } from './componentes/ui'
import { Login } from './telas/login/Login'
import { Grade } from './telas/grade/Grade'
import { Solicitar } from './telas/solicitar/Solicitar'
import { Pedidos } from './telas/pedidos/Pedidos'
import { Saldo } from './telas/saldo/Saldo'
import { Cadastros } from './telas/cadastros/Cadastros'
import { PainelTV } from './telas/painel-tv/PainelTV'

export function App() {
  const { usuario, carregando } = useSessao()
  return (
    <ToastProvider>
      <Routes>
        {/* Painel da TV: público, sem login (CA-20) */}
        <Route path="/tv" element={<PainelTV />} />
        <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <Login />} />
        <Route
          element={carregando ? <div className="p-10 text-slate-500">Carregando…</div> : usuario ? <Layout /> : <Navigate to="/login" replace />}
        >
          <Route index element={<Grade />} />
          <Route path="solicitar" element={<Solicitar />} />
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="saldo" element={<Saldo />} />
          <Route path="cadastros" element={usuario?.papel === 'admin' ? <Cadastros /> : <Navigate to="/" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}
