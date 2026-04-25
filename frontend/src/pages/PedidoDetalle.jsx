import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  getPedido, getPickingList, iniciarRuta,
  facturarPedido, anularPedido, getUsuariosByRol,
} from '../api'
import { EstadoBadge } from './Dashboard'
import { useAuth } from '../context/AuthContext'

function VenceBadge({ fecha }) {
  if (!fecha) return <span className="text-gray-400 text-xs">Sin venc.</span>
  const dias = Math.ceil((new Date(fecha) - new Date()) / 86400000)
  if (dias <= 0)  return <span className="text-xs font-semibold text-white bg-red-600 px-1.5 py-0.5 rounded">Vencido</span>
  if (dias <= 7)  return <span className="text-xs font-semibold text-red-600">{fecha} ({dias}d)</span>
  if (dias <= 15) return <span className="text-xs text-orange-500">{fecha} ({dias}d)</span>
  if (dias <= 30) return <span className="text-xs text-yellow-600">{fecha} ({dias}d)</span>
  return <span className="text-xs text-gray-500">{fecha}</span>
}

export default function PedidoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [pedido, setPedido] = useState(null)
  const [picking, setPicking] = useState(null)
  const [choferes, setChoferes] = useState([])
  const [choferId, setChoferId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const canFacturar = ['admin', 'facturacion'].includes(user?.rol)
  const canAlmacen  = ['admin', 'almacenista'].includes(user?.rol)
  const canAnular   = user?.rol === 'admin'

  const load = () => {
    setLoading(true)
    getPedido(id)
      .then((r) => {
        setPedido(r.data)
        if (canAlmacen && ['facturado', 'en_ruta'].includes(r.data.estado)) {
          getPickingList(id).then((pr) => setPicking(pr.data)).catch(() => setPicking(null))
        } else {
          setPicking(null)
        }
      })
      .catch(() => toast.error('Error cargando pedido'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (canAlmacen) {
      getUsuariosByRol('chofer').then((r) => setChoferes(r.data)).catch(() => setChoferes([]))
    }
  }, [user?.rol])

  const handleFacturar = async () => {
    if (!confirm(`¿Marcar pedido ${pedido.numero_pedido} como facturado?`)) return
    setSubmitting(true)
    try {
      await facturarPedido(id)
      toast.success('Pedido facturado')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al facturar')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAnular = async () => {
    if (!confirm(`¿Anular pedido ${pedido.numero_pedido}? Esta acción no se puede deshacer.`)) return
    setSubmitting(true)
    try {
      await anularPedido(id)
      toast.success('Pedido anulado')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al anular')
    } finally {
      setSubmitting(false)
    }
  }

  const handleIniciarRuta = async () => {
    if (!choferId) return toast.error('Selecciona un chofer')
    setSubmitting(true)
    try {
      await iniciarRuta(id, { chofer_id: Number(choferId) })
      toast.success('Ruta iniciada — pedido enviado al chofer')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al iniciar ruta')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="text-gray-400 text-sm">Cargando...</p>
  if (!pedido) return <p className="text-gray-400 text-sm">Pedido no encontrado.</p>

  const tieneDeficit = picking?.picking?.some((p) => p.deficit > 0)

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Link to="/pedidos" className="text-blue-600 text-sm hover:underline">← Pedidos</Link>
        <span className="text-gray-400">/</span>
        <h2 className="text-xl font-bold text-gray-800 font-mono">{pedido.numero_pedido}</h2>
        <EstadoBadge estado={pedido.estado} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        <div className="md:col-span-2 bg-white rounded-lg shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Información</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Tienda</dt>
            <dd className="font-medium">{pedido.tienda}</dd>
            <dt className="text-gray-500">Zona</dt>
            <dd>{pedido.tienda_zona ?? '—'}</dd>
            <dt className="text-gray-500">Vendedor</dt>
            <dd>{pedido.vendedor ?? '—'}</dd>
            <dt className="text-gray-500">Creado</dt>
            <dd>{pedido.creado_en ? new Date(pedido.creado_en).toLocaleString('es-VE') : '—'}</dd>
            {pedido.facturado_en && (
              <>
                <dt className="text-gray-500">Facturado</dt>
                <dd>{new Date(pedido.facturado_en).toLocaleString('es-VE')}</dd>
              </>
            )}
            {pedido.nota && (
              <>
                <dt className="text-gray-500">Nota</dt>
                <dd className="col-span-1">{pedido.nota}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow p-5 space-y-2">
          <h3 className="font-semibold text-gray-700 mb-1">Acciones</h3>
          {canFacturar && pedido.estado === 'pendiente' && (
            <button onClick={handleFacturar} disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded disabled:opacity-50">
              Facturar pedido
            </button>
          )}
          {canAnular && !['entregado', 'anulado'].includes(pedido.estado) && (
            <button onClick={handleAnular} disabled={submitting}
              className="w-full border border-red-400 text-red-600 hover:bg-red-50 text-sm py-2 rounded disabled:opacity-50">
              Anular pedido
            </button>
          )}
          {!canFacturar && !canAnular && pedido.estado === 'pendiente' && (
            <p className="text-xs text-gray-400">Esperando facturación.</p>
          )}
          {pedido.estado === 'entregado' && (
            <p className="text-xs text-green-600">Pedido entregado al cliente.</p>
          )}
          {pedido.estado === 'anulado' && (
            <p className="text-xs text-red-500">Pedido anulado.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-5 overflow-x-auto">
        <h3 className="font-semibold text-gray-700 px-5 pt-4">Detalles del pedido</h3>
        <table className="w-full text-sm mt-2">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-5 py-2 text-left">Código</th>
              <th className="px-5 py-2 text-left">Producto</th>
              <th className="px-5 py-2 text-right">Bultos</th>
              <th className="px-5 py-2 text-right">Uds. sueltas</th>
              <th className="px-5 py-2 text-right">Total uds.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pedido.detalles?.map((d) => (
              <tr key={d.id}>
                <td className="px-5 py-2 font-mono text-xs text-gray-500">{d.codigo}</td>
                <td className="px-5 py-2 font-medium">{d.descripcion}</td>
                <td className="px-5 py-2 text-right">{d.cantidad_bultos}</td>
                <td className="px-5 py-2 text-right">{d.cantidad_unidades}</td>
                <td className="px-5 py-2 text-right text-gray-500">{d.total_unidades}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canAlmacen && picking && (
        <div className="bg-white rounded-lg shadow mb-5">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">
              Picking list (FEFO)
              {tieneDeficit && (
                <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  Stock insuficiente
                </span>
              )}
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {picking.picking.map((p) => (
              <div key={p.producto_id} className="px-5 py-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-medium">{p.descripcion}</p>
                    <p className="text-xs text-gray-500">
                      {p.codigo} · pedido: {p.cantidad_pedida_bultos} bultos + {p.cantidad_pedida_unidades} sueltas ({p.total_unidades} uds.)
                    </p>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-500">Stock: </span>
                    <span className="font-medium">{p.stock_disponible} uds.</span>
                    {p.deficit > 0 && (
                      <span className="ml-2 text-red-600 font-semibold">Faltan {p.deficit} uds.</span>
                    )}
                  </div>
                </div>
                {p.extraccion.length > 0 && (
                  <table className="w-full text-xs mt-2 border rounded">
                    <thead className="bg-gray-50 text-gray-400 uppercase">
                      <tr>
                        <th className="px-3 py-1.5 text-left">Lote</th>
                        <th className="px-3 py-1.5 text-left">Ubicación</th>
                        <th className="px-3 py-1.5 text-left">Vencimiento</th>
                        <th className="px-3 py-1.5 text-right">Bultos a sacar</th>
                        <th className="px-3 py-1.5 text-right">Uds. sueltas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.extraccion.map((e) => (
                        <tr key={e.lote_id} className="border-t">
                          <td className="px-3 py-1.5">#{e.lote_id} {e.numero_lote && `· ${e.numero_lote}`}</td>
                          <td className="px-3 py-1.5 text-gray-500">{e.ubicacion ?? '—'}</td>
                          <td className="px-3 py-1.5"><VenceBadge fecha={e.fecha_vencimiento} /></td>
                          <td className="px-3 py-1.5 text-right font-medium">{e.bultos_a_sacar}</td>
                          <td className="px-3 py-1.5 text-right">{e.unidades_sueltas_a_sacar}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>

          {pedido.estado === 'facturado' && (
            <div className="px-5 py-4 border-t bg-gray-50 flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Asignar chofer:</label>
              <select
                value={choferId}
                onChange={(e) => setChoferId(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar chofer...</option>
                {choferes.map((c) => <option key={c.id} value={c.id}>{c.username}</option>)}
              </select>
              <button
                onClick={handleIniciarRuta}
                disabled={submitting || !choferId || tieneDeficit}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-1.5 rounded disabled:opacity-50"
              >
                {submitting ? 'Iniciando...' : 'Iniciar ruta'}
              </button>
              {tieneDeficit && (
                <span className="text-xs text-red-600">No se puede iniciar: stock insuficiente.</span>
              )}
            </div>
          )}
          {pedido.estado === 'en_ruta' && (
            <div className="px-5 py-3 border-t bg-blue-50 text-sm text-blue-700">
              Pedido en ruta — el chofer ya tiene la mercancía.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
