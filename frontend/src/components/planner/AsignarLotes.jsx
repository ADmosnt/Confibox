import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getLotes, ubicarLote } from '../../api'

export default function AsignarLotes({ ubicacion, nivel, onAssigned, onClose }) {
  const [lotes, setLotes] = useState([])
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    getLotes({ con_stock: 'true' }).then((r) => {
      // Show lotes that aren't already in this exact slot
      const current = new Set()
      const fresh = r.data.filter((l) => {
        if (l.ubicacion_id === ubicacion.id && (l.nivel ?? null) === (nivel ?? null)) return false
        return true
      })
      setLotes(fresh)
    }).catch(() => toast.error('Error cargando lotes'))
  }, [ubicacion.id, nivel])

  const visibles = lotes.filter((l) => {
    if (!filter.trim()) return true
    const q = filter.toLowerCase()
    return (l.descripcion ?? '').toLowerCase().includes(q) ||
           (l.codigo ?? '').toLowerCase().includes(q) ||
           (l.numero_lote ?? '').toLowerCase().includes(q)
  })

  const assign = async (lote) => {
    setBusy(lote.id)
    try {
      await ubicarLote(lote.id, { ubicacion_id: ubicacion.id, nivel })
      toast.success(`${lote.descripcion} asignado`)
      onAssigned()
      setLotes((ls) => ls.filter((l) => l.id !== lote.id))
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al asignar')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800">Asignar lotes</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Destino: <span className="font-mono">{ubicacion.codigo}{nivel ? `-N${nivel}` : ''}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-3 border-b">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar por producto, código o número de lote..."
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {visibles.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No hay lotes para asignar</p>
          ) : visibles.map((l) => (
            <button
              key={l.id}
              onClick={() => assign(l)}
              disabled={busy === l.id}
              className="w-full text-left border border-gray-100 rounded p-2 hover:bg-blue-50 hover:border-blue-200 transition-colors disabled:opacity-50"
            >
              <p className="font-medium text-sm text-gray-800">{l.descripcion}</p>
              <p className="text-xs text-gray-500">
                {l.codigo} · {l.cantidad_bultos}b · {l.cantidad_unidades}u
                {l.numero_lote && ` · #${l.numero_lote}`}
              </p>
              {l.ubicacion_almacen && (
                <p className="text-xs text-gray-400">
                  Actualmente en: <span className="font-mono">{l.ubicacion_almacen}</span>
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
