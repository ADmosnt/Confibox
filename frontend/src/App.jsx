import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { TooltipProvider } from './components/ui/Tooltip'
import { AuthProvider } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import Layout from './components/Layout'

import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Dashboard from './pages/Dashboard'
import Tiendas from './pages/Tiendas'
import TiendaDetalle from './pages/TiendaDetalle'
import TiendaForm from './pages/TiendaForm'
import Productos from './pages/Productos'
import Lotes from './pages/Lotes'
import Pedidos from './pages/Pedidos'
import PedidoDetalle from './pages/PedidoDetalle'
import PedidoForm from './pages/PedidoForm'
import MiRuta from './pages/MiRuta'
import Entregas from './pages/Entregas'
import SolicitudesGeoref from './pages/SolicitudesGeoref'
import MapaEnVivo from './pages/MapaEnVivo'
import JornadaEquipo from './pages/JornadaEquipo'
import AlmacenPlanner from './pages/AlmacenPlanner'
import Usuarios from './pages/Usuarios'
import Configuracion from './pages/Configuracion'

const ALL = ['admin', 'vendedor', 'facturacion', 'almacenista', 'chofer']

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
      <TooltipProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />

              {/* Admin + almacenista */}
              <Route path="dashboard" element={
                <RequireAuth roles={['admin', 'almacenista']}>
                  <Dashboard />
                </RequireAuth>
              } />

              {/* Tiendas — all roles */}
              <Route path="tiendas" element={
                <RequireAuth roles={ALL}>
                  <Tiendas />
                </RequireAuth>
              } />
              <Route path="tiendas/nueva" element={
                <RequireAuth roles={['admin', 'vendedor']}>
                  <TiendaForm />
                </RequireAuth>
              } />
              <Route path="tiendas/:id" element={
                <RequireAuth roles={ALL}>
                  <TiendaDetalle />
                </RequireAuth>
              } />
              <Route path="tiendas/:id/editar" element={
                <RequireAuth roles={['admin', 'vendedor']}>
                  <TiendaForm />
                </RequireAuth>
              } />

              {/* Productos */}
              <Route path="productos" element={
                <RequireAuth roles={['admin', 'vendedor', 'almacenista', 'chofer']}>
                  <Productos />
                </RequireAuth>
              } />

              {/* Inventario / Lotes */}
              <Route path="inventario" element={
                <RequireAuth roles={['admin', 'almacenista']}>
                  <Lotes />
                </RequireAuth>
              } />

              {/* WMS Planner */}
              <Route path="almacen-planner" element={
                <RequireAuth roles={['admin', 'almacenista']}>
                  <AlmacenPlanner />
                </RequireAuth>
              } />

              {/* Pedidos */}
              <Route path="pedidos" element={
                <RequireAuth roles={['admin', 'vendedor', 'facturacion', 'almacenista']}>
                  <Pedidos />
                </RequireAuth>
              } />
              <Route path="pedidos/nuevo" element={
                <RequireAuth roles={['admin', 'vendedor']}>
                  <PedidoForm />
                </RequireAuth>
              } />
              <Route path="pedidos/:id" element={
                <RequireAuth roles={['admin', 'vendedor', 'facturacion', 'almacenista']}>
                  <PedidoDetalle />
                </RequireAuth>
              } />

              {/* Mi ruta (chofer + ayudante) */}
              <Route path="mi-ruta" element={
                <RequireAuth roles={['chofer', 'ayudante', 'admin']}>
                  <MiRuta />
                </RequireAuth>
              } />

              {/* Entregas */}
              <Route path="entregas" element={
                <RequireAuth roles={['admin', 'almacenista', 'chofer', 'ayudante']}>
                  <Entregas />
                </RequireAuth>
              } />

              {/* Mapa en vivo (admin) */}
              <Route path="mapa-en-vivo" element={
                <RequireAuth roles={['admin']}>
                  <MapaEnVivo />
                </RequireAuth>
              } />

              {/* Jornada equipo (admin) */}
              <Route path="jornada-equipo" element={
                <RequireAuth roles={['admin']}>
                  <JornadaEquipo />
                </RequireAuth>
              } />

              {/* Solicitudes GPS */}
              <Route path="solicitudes-georef" element={
                <RequireAuth roles={['admin']}>
                  <SolicitudesGeoref />
                </RequireAuth>
              } />

              {/* Admin only */}
              <Route path="usuarios" element={
                <RequireAuth roles={['admin']}>
                  <Usuarios />
                </RequireAuth>
              } />
              <Route path="configuracion" element={
                <RequireAuth roles={['admin']}>
                  <Configuracion />
                </RequireAuth>
              } />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </TooltipProvider>
    </BrowserRouter>
  )
}
