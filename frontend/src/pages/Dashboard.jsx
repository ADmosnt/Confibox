import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboard } from '../api'
import { EstadoBadge } from '../components/EstadoBadge'
import { VenceBadge } from '../components/VenceBadge'

function StatCard({ label, value, to, sub, color = 'text-gray-800' }) {
  const inner = (
    <div className="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow h-full">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
  return to ? <Link to={to} className="block">{inner}</Link> : inner
}


export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboard()
      .then((r) => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-400 text-sm">Cargando...</p>

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Dashboard</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-3">
        <StatCard label="Tiendas activas"       value={data?.total_tiendas}   to="/tiendas" />
        <StatCard label="Productos activos"      value={data?.total_productos} to="/productos" />
        <StatCard label="Pedidos este mes"       value={data?.pedidos_mes}     to="/pedidos" />
        <StatCard
          label="Pedidos por gestionar"
          value={data?.pedidos_pendientes}
          to="/pedidos"
          color={data?.pedidos_pendientes > 0 ? 'text-orange-600' : 'text-gray-800'}
        />
        <StatCard
          label="Entregas hoy"
          value={`${data?.entregas_completadas_hoy ?? 0} / ${data?.entregas_hoy ?? 0}`}
          to="/entregas"
          sub="completadas / total"
        />
      </div>

      {/* Lotes próximos a vencer */}
      {data?.lotes_por_vencer?.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">
              Lotes próximos a vencer
              <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                {data.lotes_por_vencer.length}
              </span>
            </h3>
            <Link to="/inventario" className="text-sm text-blue-600 hover:underline">
              Ver inventario
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Producto</th>
                  <th className="px-5 py-3 text-left">Ubicación</th>
                  <th className="px-5 py-3 text-right">Bultos</th>
                  <th className="px-5 py-3 text-left">Vence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.lotes_por_vencer.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium">{l.descripcion}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{l.ubicacion_almacen ?? '—'}</td>
                    <td className="px-5 py-3 text-right">{l.cantidad_bultos}</td>
                    <td className="px-5 py-3"><VenceBadge fecha={l.fecha_vencimiento} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Últimos pedidos */}
      {data?.ultimos_pedidos?.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Últimos pedidos</h3>
            <Link to="/pedidos" className="text-sm text-blue-600 hover:underline">Ver todos</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">N° Pedido</th>
                  <th className="px-5 py-3 text-left">Tienda</th>
                  <th className="px-5 py-3 text-left">Zona</th>
                  <th className="px-5 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.ultimos_pedidos.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-blue-600">{p.numero_pedido}</td>
                    <td className="px-5 py-3">{p.tienda}</td>
                    <td className="px-5 py-3 text-gray-500">{p.tienda_zona ?? '—'}</td>
                    <td className="px-5 py-3 text-center">
                      <EstadoBadge estado={p.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// Re-exported so existing imports from './Dashboard' keep working
export { EstadoBadge } from '../components/EstadoBadge'
