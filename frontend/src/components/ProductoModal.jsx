import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent } from './ui/Dialog'
import { getProducto, createProducto, updateProducto, getGruposProductos } from '../api'
import Alert from './Alert'

const emptyForm = { codigo: '', descripcion: '', unidades_por_bulto: 1, grupo_id: '', activo: true }

export default function ProductoModal({ open, onClose, productoId, onSaved }) {
  const isEdit = Boolean(productoId)
  const [form, setForm] = useState(emptyForm)
  const [grupos, setGrupos] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setError('')
    getGruposProductos().then((r) => setGrupos(r.data))
    if (isEdit) {
      getProducto(productoId).then((r) => setForm({ ...r.data, grupo_id: r.data.grupo_id ?? '' }))
    } else {
      setForm(emptyForm)
    }
  }, [open, productoId])

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = { ...form, grupo_id: form.grupo_id || null }
      if (isEdit) await updateProducto(productoId, payload)
      else await createProducto(payload)
      toast.success(isEdit ? 'Producto actualizado' : 'Producto creado')
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
      <DialogContent title={isEdit ? 'Editar producto' : 'Nuevo producto'}>
        <Alert type="error" message={error} />
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Código *</label>
              <input className={inp} value={form.codigo} onChange={(e) => set('codigo', e.target.value)} required disabled={isEdit} />
            </div>
            <div>
              <label className={lbl}>Unidades por bulto *</label>
              <input type="number" min={1} className={inp} value={form.unidades_por_bulto}
                onChange={(e) => set('unidades_por_bulto', parseInt(e.target.value) || 1)} required />
            </div>
          </div>

          <div>
            <label className={lbl}>Descripción *</label>
            <input className={inp} value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} required />
          </div>

          <div>
            <label className={lbl}>Grupo</label>
            <select className={inp} value={form.grupo_id} onChange={(e) => set('grupo_id', e.target.value)}>
              <option value="">Sin grupo</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
