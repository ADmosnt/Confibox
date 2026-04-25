import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getLotes, createLote, getStockConsolidado, getProductos } from '../api'
import { Dialog, DialogContent } from '../components/ui/Dialog'
import Alert from '../components/Alert'

function VenceBadge({ fecha }) {
  if (!fecha) return <span className="text-gray-400 text-xs">Sin venc.</span>
  const dias = Math.ceil((new Date(fecha) - new Date()) / 86400000)
  if (dias <= 0)  return <span className="text-xs font-semibold text-white bg-red-600 px-1.5 py-0.5 rounded">Vencido</span>
  if (dias <= 7)  return <span className="text-xs font-semibold text-red-600">{fecha} ({dias}d)</span>
  if (dias <= 15) return <span className="text-xs text-orange-500">{fecha} ({dias}d)</span>
  if (dias <= 30) return <span className="text-xs text-yellow-600">{fecha} ({dias}d)</span>
  return <span className="text-xs text-gray-500">{fecha}</span>
}

function LoteModal({ open, onClose, onSaved }) {
  const [productos, setProductos] = useState([])
  const emptyForm = {
    producto_id: '', numero_lote: '', cantidad_bultos: 1,
    fecha_vencimiento: '', ubicacion_almacen: '',
    fecha_ingreso: new Date().toISOString().slice(0, 10), nota: '',
  }
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setError('')
    setForm(emptyForm)
    getProductos({ activo: true }).then((r) => setProductos(r.data))
  }, [open])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createLote({
        ...form,
        producto_id: Number(form.producto_id),
        cantidad_bultos: Number(form.cantidad_bultos),
        fecha_vencimiento: form.fecha_vencimiento || null,
      })
      toast.success('Lote registrado')
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const lbl = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Registrar lote de inventario" size="md">
        <Alert type="error" message={error} />
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={lbl}>Producto *</label>
            <select className={inp} value={form.producto_id} onChange={(e) => set('producto_id', e.target.value)} required>
              <option value="">Seleccionar producto...</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>{p.descripcion} ({p.codigo})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>N° de lote</label>
              <input className={inp} value={form.numero_lote} onChange={(e) => set('numero_lote', e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <label className={lbl}>Cantidad bultos *</label>
              <input type="number" min={1} className={inp} value={form.cantidad_bultos}
                onChange={(e) => set('cantidad_bultos', e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Fecha vencimiento</label>
              <input type="date" className={inp} value={form.fecha_vencimiento}
                onChange={(e) => set('fecha_vencimiento', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Fecha ingreso *</label>
              <input type="date" className={inp} value={form.fecha_ingreso}
                onChange={(e) => set('fecha_ingreso', e.target.value)} required />
            </div>
          </div>

          <div>
            <label className={lbl}>Ubicación en almacén</label>
            <input className={inp} value={form.ubicacion_almacen}
              onChange={(e) => set('ubicacion_almacen', e.target.value)} placeholder="Ej: Estante A2" />
          </div>

          <div>
            <label className={lbl}>Nota</label>
            <textarea className={inp} rows={2} value={form.nota}
              onChange={(e) => set('nota', e.target.value)} placeholder="Opcional" />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Lotes() {
  const [lotes, setLotes] = useState([])
  const [stock, setStock] = useState([])
  const [vista, setVista] = useState('lotes')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [soloConStock, setSoloConStock] = useState(true)

  const loadLotes = () => {
    setLoading(true)
    getLotes(soloConStock ? { con_stock: 'true' } : {})
      .then((r) => setLotes(r.data))
      .catch(() => toast.error('Error cargando lotes'))
      .finally(() => setLoading(false))
  }

  const loadStock = () => {
    setLoading(true)
    getStockConsolidado()
      .then((r) => setStock(r.data))
      .catch(() => toast.error('Error cargando stock'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (vista === 'lotes') loadLotes()
    else loadStock()
  }, [vista, soloConStock])

  const handleSaved = () => {
    if (vista === 'lotes') loadLotes()
    else loadStock()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-800">Inventario</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setVista((v) => v === 'lotes' ? 'stock' : 'lotes')}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg"
          >
            {vista === 'lotes' ? 'Stock consolidado' : 'Ver por lote'}
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg"
          >
            + Nuevo lote
          </button>
        </div>
      </div>

      {vista === 'lotes' && (
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={soloConStock}
              onChange={(e) => setSoloConStock(e.target.checked)}
              className="rounded"
            />
            Solo lotes con stock disponible
          </label>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-10">Cargando...</p>
        ) : vista === 'lotes' ? (
          lotes.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">No hay lotes registrados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Código</th>
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-left">N° Lote</th>
                  <th className="px-4 py-3 text-right">Bultos</th>
                  <th className="px-4 py-3 text-left">Ubicación</th>
                  <th className="px-4 py-3 text-left">Vencimiento</th>
                  <th className="px-4 py-3 text-left">Ingreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lotes.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{l.codigo}</td>
                    <td className="px-4 py-3 font-medium">{l.descripcion}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{l.numero_lote ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{l.cantidad_bultos}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{l.ubicacion_almacen ?? '—'}</td>
                    <td className="px-4 py-3"><VenceBadge fecha={l.fecha_vencimiento} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{l.fecha_ingreso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          stock.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">Sin stock registrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Código</th>
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-right">Uds/Bulto</th>
                  <th className="px-4 py-3 text-right">Total Bultos</th>
                  <th className="px-4 py-3 text-right">Total Unidades</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stock.map((s) => (
                  <tr key={s.producto_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.codigo}</td>
                    <td className="px-4 py-3 font-medium">{s.descripcion}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{s.unidades_por_bulto}</td>
                    <td className="px-4 py-3 text-right font-medium">{s.total_bultos}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{s.total_unidades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      <LoteModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={handleSaved} />
    </div>
  )
}
