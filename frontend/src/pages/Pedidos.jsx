import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { getPedidos, facturarPedido, anularPedido } from '../api'
import { EstadoBadge } from './Dashboard'
import { useAuth } from '../context/AuthContext'

const ESTADOS = [
  { value: '', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'facturado', label: 'Facturado' },
  { value: 'en_ruta', label: 'En ruta' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'con_incidencia', label: 'Con incidencia' },
  { value: 'anulado', label: 'Anulado' },
]

export default function Pedidos() {
  const { user } = useAuth()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [estado, setEstado] = useState('')

  const load = () => {
    setLoading(true)
    getPedidos({ estado: estado || undefined })
      .then((r) => setPedidos(r.data))
      .catch(() => toast.error('Error cargando pedidos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [estado])

  const handleFacturar = async (id, numero) => {
    if (!confirm(`¿Marcar pedido ${numero} como facturado?`)) return
    try {
      await facturarPedido(id)
      toast.success(`Pedido ${numero} facturado`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al facturar')
    }
  }

  const handleAnular = async (id, numero) => {
    if (!confirm(`¿Anular pedido ${numero}? Esta acción no se puede deshacer.`)) return
    try {
      await anularPedido(id)
      toast.success(`Pedido ${numero} anulado`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al anular')
    }
  }

  const canFacturar = user?.rol === 'facturacion' || user?.rol === 'admin'
  const canAnular   = user?.rol === 'admin'
  const canCrear    = ['admin', 'vendedor'].includes(user?.rol)

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

      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-10">Cargando...</p>
        ) : pedidos.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">No hay pedidos.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">N° Pedido</th>
                <th className="px-4 py-3 text-left">Tienda</th>
                <th className="px-4 py-3 text-left">Zona</th>
                <th className="px-4 py-3 text-left">Vendedor</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                {(canFacturar || canAnular) && <th className="px-4 py-3 text-center">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pedidos.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link to={`/pedidos/${p.id}`} className="text-blue-600 hover:underline">{p.numero_pedido}</Link>
                  </td>
                  <td className="px-4 py-3 font-medium">{p.tienda}</td>
                  <td className="px-4 py-3 text-gray-500">{p.tienda_zona ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{p.vendedor ?? '—'}</td>
                  <td className="px-4 py-3 text-center"><EstadoBadge estado={p.estado} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {p.creado_en ? new Date(p.creado_en).toLocaleDateString('es-VE') : '—'}
                  </td>
                  {(canFacturar || canAnular) && (
                    <td className="px-4 py-3 text-center space-x-2 whitespace-nowrap">
                      {canFacturar && p.estado === 'pendiente' && (
                        <button
                          onClick={() => handleFacturar(p.id, p.numero_pedido)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Facturar
                        </button>
                      )}
                      {canAnular && !['entregado', 'anulado'].includes(p.estado) && (
                        <button
                          onClick={() => handleAnular(p.id, p.numero_pedido)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Anular
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
