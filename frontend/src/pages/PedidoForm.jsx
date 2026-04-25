import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { getTiendas, getProductos, createPedido } from '../api'

export default function PedidoForm() {
  const navigate = useNavigate()
  const [tiendas, setTiendas] = useState([])
  const [productos, setProductos] = useState([])
  const [tiendaId, setTiendaId] = useState('')
  const [tiendaSearch, setTiendaSearch] = useState('')
  const [productoSearch, setProductoSearch] = useState('')
  const [detalles, setDetalles] = useState([])
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getTiendas({ activo: true }).then((r) => setTiendas(r.data)).catch(() => toast.error('Error cargando tiendas'))
    getProductos({ activo: true }).then((r) => setProductos(r.data)).catch(() => toast.error('Error cargando productos'))
  }, [])

  const tiendasFiltradas = useMemo(() => {
    const q = tiendaSearch.toLowerCase()
    if (!q) return tiendas.slice(0, 30)
    return tiendas.filter((t) =>
      t.razon_social.toLowerCase().includes(q) ||
      t.codigo.toLowerCase().includes(q) ||
      (t.zona ?? '').toLowerCase().includes(q)
    )
  }, [tiendas, tiendaSearch])

  const productosDisponibles = useMemo(() => {
    const yaAgregados = new Set(detalles.map((d) => d.producto_id))
    const q = productoSearch.toLowerCase()
    return productos
      .filter((p) => !yaAgregados.has(p.id))
      .filter((p) => !q || p.descripcion.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
      .slice(0, 20)
  }, [productos, detalles, productoSearch])

  const tiendaSeleccionada = tiendas.find((t) => String(t.id) === String(tiendaId))

  const agregarProducto = (p) => {
    setDetalles((d) => [...d, {
      producto_id: p.id,
      codigo: p.codigo,
      descripcion: p.descripcion,
      unidades_por_bulto: p.unidades_por_bulto,
      cantidad_bultos: 1,
      cantidad_unidades: 0,
    }])
    setProductoSearch('')
  }

  const updateDetalle = (idx, key, val) => {
    setDetalles((d) => d.map((det, i) => i === idx ? { ...det, [key]: val } : det))
  }

  const removerDetalle = (idx) => {
    setDetalles((d) => d.filter((_, i) => i !== idx))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!tiendaId) return setError('Selecciona una tienda')
    if (detalles.length === 0) return setError('Agrega al menos un producto')

    const detallesPayload = detalles.map((d) => ({
      producto_id: d.producto_id,
      cantidad_bultos: Number(d.cantidad_bultos) || 0,
      cantidad_unidades: Number(d.cantidad_unidades) || 0,
    }))
    const totalCero = detallesPayload.every((d) => d.cantidad_bultos === 0 && d.cantidad_unidades === 0)
    if (totalCero) return setError('Cada detalle debe tener al menos una cantidad mayor que cero')

    setSaving(true)
    try {
      const r = await createPedido({
        tienda_id: Number(tiendaId),
        nota: nota || undefined,
        detalles: detallesPayload,
      })
      toast.success(`Pedido ${r.data.numero_pedido} creado`)
      navigate(`/pedidos/${r.data.id}`)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al crear pedido')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Link to="/pedidos" className="text-blue-600 text-sm hover:underline">← Pedidos</Link>
        <span className="text-gray-400">/</span>
        <h2 className="text-xl font-bold text-gray-800">Nuevo pedido</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Tienda</h3>
          {tiendaSeleccionada ? (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <div>
                <p className="font-semibold text-gray-800">{tiendaSeleccionada.razon_social}</p>
                <p className="text-xs text-gray-500">
                  {tiendaSeleccionada.codigo} · {tiendaSeleccionada.zona ?? 'Sin zona'} · {tiendaSeleccionada.empresa}
                </p>
              </div>
              <button type="button" onClick={() => { setTiendaId(''); setTiendaSearch('') }} className="text-xs text-red-500 hover:underline">
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Buscar tienda por nombre, código o zona..."
                value={tiendaSearch}
                onChange={(e) => setTiendaSearch(e.target.value)}
                className={inp}
              />
              {tiendaSearch && (
                <div className="mt-2 max-h-48 overflow-y-auto border rounded-md divide-y">
                  {tiendasFiltradas.length === 0 ? (
                    <p className="p-3 text-sm text-gray-400">Sin resultados</p>
                  ) : tiendasFiltradas.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setTiendaId(t.id); setTiendaSearch('') }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                    >
                      <span className="font-medium">{t.razon_social}</span>
                      <span className="text-xs text-gray-500 ml-2">{t.codigo} · {t.zona ?? 'Sin zona'}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Productos</h3>

          <input
            type="text"
            placeholder="Buscar producto para agregar..."
            value={productoSearch}
            onChange={(e) => setProductoSearch(e.target.value)}
            className={inp}
          />
          {productoSearch && (
            <div className="mt-2 max-h-48 overflow-y-auto border rounded-md divide-y">
              {productosDisponibles.length === 0 ? (
                <p className="p-3 text-sm text-gray-400">Sin resultados</p>
              ) : productosDisponibles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => agregarProducto(p)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                >
                  <span className="font-medium">{p.descripcion}</span>
                  <span className="text-xs text-gray-500 ml-2">{p.codigo} · {p.unidades_por_bulto} u/b</span>
                </button>
              ))}
            </div>
          )}

          {detalles.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Producto</th>
                    <th className="px-3 py-2 text-right">Bultos</th>
                    <th className="px-3 py-2 text-right">Uds. sueltas</th>
                    <th className="px-3 py-2 text-right">Total uds.</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detalles.map((d, idx) => {
                    const totalUds = (Number(d.cantidad_bultos) || 0) * d.unidades_por_bulto + (Number(d.cantidad_unidades) || 0)
                    return (
                      <tr key={d.producto_id}>
                        <td className="px-3 py-2">
                          <span className="font-medium">{d.descripcion}</span>
                          <span className="text-xs text-gray-400 block">{d.codigo} · {d.unidades_por_bulto} u/b</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number" min={0}
                            value={d.cantidad_bultos}
                            onChange={(e) => updateDetalle(idx, 'cantidad_bultos', e.target.value)}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number" min={0}
                            value={d.cantidad_unidades}
                            onChange={(e) => updateDetalle(idx, 'cantidad_unidades', e.target.value)}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500">{totalUds}</td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={() => removerDetalle(idx)} className="text-red-500 hover:underline text-xs">
                            Quitar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {detalles.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">
              Agrega productos al pedido buscándolos arriba.
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Nota (opcional)</h3>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Comentarios para facturación o el chofer..."
            className={inp}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Link to="/pedidos" className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving || !tiendaId || detalles.length === 0}
            className="px-6 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Creando...' : 'Crear pedido'}
          </button>
        </div>
      </form>
    </div>
  )
}
