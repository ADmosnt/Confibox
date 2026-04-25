import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { getPedidosByEstados, facturarPedido, anularPedido } from '../api'
import { EstadoBadge } from '../components/EstadoBadge'
import { useAuth } from '../context/AuthContext'

// Group an array of pedidos by date string (YYYY-MM-DD local)
function byDay(pedidos) {
  const groups = {}
  for (const p of pedidos) {
    const day = p.creado_en
      ? new Date(p.creado_en).toLocaleDateString('es-VE', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : 'Sin fecha'
    if (!groups[day]) groups[day] = []
    groups[day].push(p)
  }
  return Object.entries(groups) // [[date, [pedidos]], ...]
}

function PedidoRow({ p, canFacturar, canAnular, onAction }) {
  const handleFacturar = async () => {
    if (!confirm(`¿Facturar pedido ${p.numero_pedido}?`)) return
    try { await facturarPedido(p.id); toast.success(`${p.numero_pedido} facturado`); onAction() }
    catch (err) { toast.error(err.response?.data?.error ?? 'Error al facturar') }
  }
  const handleAnular = async () => {
    if (!confirm(`¿Anular pedido ${p.numero_pedido}? No se puede deshacer.`)) return
    try { await anularPedido(p.id); toast.success(`${p.numero_pedido} anulado`); onAction() }
    catch (err) { toast.error(err.response?.data?.error ?? 'Error al anular') }
  }
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2.5 font-mono text-xs">
        <Link to={`/pedidos/${p.id}`} className="text-blue-600 hover:underline">{p.numero_pedido}</Link>
      </td>
      <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[160px]">
        <span className="block truncate" title={p.tienda}>{p.tienda}</span>
      </td>
      <td className="px-4 py-2.5 text-gray-500 text-xs">{p.tienda_zona ?? '—'}</td>
      <td className="px-4 py-2.5 text-gray-500 text-xs">{p.vendedor ?? '—'}</td>
      <td className="px-4 py-2.5 text-center"><EstadoBadge estado={p.estado} /></td>
      {(canFacturar || canAnular) && (
        <td className="px-4 py-2.5 text-center space-x-2 whitespace-nowrap">
          {canFacturar && p.estado === 'pendiente' && (
            <button onClick={handleFacturar} className="text-xs text-blue-600 hover:underline">Facturar</button>
          )}
          {canAnular && !['entregado', 'anulado'].includes(p.estado) && (
            <button onClick={handleAnular} className="text-xs text-red-500 hover:underline">Anular</button>
          )}
        </td>
      )}
    </tr>
  )
}

function DayGroup({ date, pedidos, canFacturar, canAnular, onAction }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200"
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>{date}</span>
        <span className="ml-auto font-normal normal-case text-gray-400">{pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}</span>
      </button>
      {open && pedidos.map((p) => (
        <PedidoRow key={p.id} p={p} canFacturar={canFacturar} canAnular={canAnular} onAction={onAction} />
      ))}
    </div>
  )
}

function Panel({ title, color, pedidos, loading, canFacturar, canAnular, onAction, emptyMsg }) {
  const [open, setOpen] = useState(true)
  const days = byDay(pedidos)

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-5 py-3.5 text-left border-b ${color}`}
      >
        <span className="font-semibold text-sm">{title}</span>
        <span className="ml-auto text-xs font-normal opacity-75">
          {loading ? '…' : `${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''}`}
        </span>
        <span className="text-xs">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        loading ? (
          <p className="text-center text-gray-400 text-sm py-6">Cargando...</p>
        ) : pedidos.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-6">{emptyMsg}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">N° Pedido</th>
                  <th className="px-4 py-2 text-left">Tienda</th>
                  <th className="px-4 py-2 text-left">Zona</th>
                  <th className="px-4 py-2 text-left">Vendedor</th>
                  <th className="px-4 py-2 text-center">Estado</th>
                  {(canFacturar || canAnular) && <th className="px-4 py-2 text-center">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {days.map(([date, group]) => (
                  <DayGroup
                    key={date}
                    date={date}
                    pedidos={group}
                    canFacturar={canFacturar}
                    canAnular={canAnular}
                    onAction={onAction}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

export default function Pedidos() {
  const { user } = useAuth()
  const [pendientes,  setPendientes]  = useState([])
  const [facturados,  setFacturados]  = useState([])
  const [enRuta,      setEnRuta]      = useState([])
  const [historial,   setHistorial]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [histFecha,   setHistFecha]   = useState('')
  const [histLoading, setHistLoading] = useState(false)

  const canFacturar = ['facturacion', 'admin'].includes(user?.rol)
  const canAnular   = user?.rol === 'admin'
  const canCrear    = ['admin', 'vendedor'].includes(user?.rol)

  const loadActive = useCallback(() => {
    setLoading(true)
    getPedidosByEstados(['pendiente', 'facturado', 'en_ruta'])
      .then((r) => {
        const all = r.data
        setPendientes(all.filter((p) => p.estado === 'pendiente'))
        setFacturados(all.filter((p) => p.estado === 'facturado'))
        setEnRuta(all.filter((p) => p.estado === 'en_ruta'))
      })
      .catch(() => toast.error('Error cargando pedidos'))
      .finally(() => setLoading(false))
  }, [])

  const loadHistory = useCallback(() => {
    setHistLoading(true)
    getPedidosByEstados(['entregado', 'con_incidencia', 'anulado'], { fecha: histFecha || undefined })
      .then((r) => setHistorial(r.data))
      .catch(() => toast.error('Error cargando historial'))
      .finally(() => setHistLoading(false))
  }, [histFecha])

  useEffect(() => { loadActive() }, [loadActive])
  useEffect(() => { if (showHistory) loadHistory() }, [showHistory, loadHistory])

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-800">Pedidos</h2>
        {canCrear && (
          <Link
            to="/pedidos/nuevo"
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg font-medium"
          >
            + Nuevo pedido
          </Link>
        )}
      </div>

      <div className="space-y-4">
        {/* Panel 1 — Por facturar */}
        <Panel
          title="Por facturar"
          color="bg-gray-50 border-gray-200 text-gray-700"
          pedidos={pendientes}
          loading={loading}
          canFacturar={canFacturar}
          canAnular={canAnular}
          onAction={loadActive}
          emptyMsg="No hay pedidos pendientes de facturación."
        />

        {/* Panel 2 — Cargando camión */}
        <Panel
          title="Cargando camión"
          color="bg-blue-50 border-blue-200 text-blue-800"
          pedidos={facturados}
          loading={loading}
          canFacturar={false}
          canAnular={canAnular}
          onAction={loadActive}
          emptyMsg="No hay pedidos facturados esperando carga."
        />

        {/* Panel 3 — En despacho */}
        <Panel
          title="En despacho"
          color="bg-yellow-50 border-yellow-200 text-yellow-800"
          pedidos={enRuta}
          loading={loading}
          canFacturar={false}
          canAnular={canAnular}
          onAction={loadActive}
          emptyMsg="No hay pedidos en ruta actualmente."
        />

        {/* Historial (entregado / con_incidencia / anulado) */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-left border-b bg-gray-50 text-gray-600"
          >
            <span className="font-semibold text-sm">Historial</span>
            <span className="ml-auto text-xs opacity-75">entregados · con incidencia · anulados</span>
            <span className="text-xs">{showHistory ? '▾' : '▸'}</span>
          </button>

          {showHistory && (
            <div>
              <div className="flex items-center gap-3 px-4 py-3 border-b bg-gray-50">
                <input
                  type="date"
                  value={histFecha}
                  onChange={(e) => setHistFecha(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {histFecha && (
                  <button onClick={() => setHistFecha('')} className="text-sm text-gray-400 hover:text-gray-600">
                    × Quitar filtro
                  </button>
                )}
                <span className="text-xs text-gray-400 ml-auto">
                  {histLoading ? '…' : `${historial.length} pedido${historial.length !== 1 ? 's' : ''}`}
                </span>
              </div>

              {histLoading ? (
                <p className="text-center text-gray-400 text-sm py-6">Cargando...</p>
              ) : historial.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">No hay pedidos en el historial para este filtro.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">N° Pedido</th>
                        <th className="px-4 py-2 text-left">Tienda</th>
                        <th className="px-4 py-2 text-left">Zona</th>
                        <th className="px-4 py-2 text-left">Vendedor</th>
                        <th className="px-4 py-2 text-center">Estado</th>
                        <th className="px-4 py-2 text-left">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {byDay(historial).map(([date, group]) => (
                        <DayGroup key={date} date={date} pedidos={group} canFacturar={false} canAnular={canAnular} onAction={loadActive} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
