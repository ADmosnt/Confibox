import { memo, useState } from 'react'
import { toast } from 'sonner'
import { ubicarLote } from '../../api'
import {
  useDataStore, useCanvasStore,
  unplacedUbicacionesSelector, useShallow,
} from '../../stores/almacenStore'
import RackElevation from './RackElevation'
import AsignarLotes from './AsignarLotes'

const COLORS = ['#DBEAFE', '#D1FAE5', '#FEF3C7', '#FCE7F3', '#EDE9FE', '#FFEDD5', '#CFFAFE', '#E0E7FF']
const inp = 'w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// ── Forms ──────────────────────────────────────────────────────────────────

function ZonaForm() {
  const addZona = useDataStore((s) => s.addZona)
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const submit = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) return toast.error('Nombre requerido')
    const ok = await addZona({ nombre: nombre.trim(), color, x: 60, y: 60, width: 240, height: 180 })
    if (ok) setNombre('')
  }
  return (
    <form onSubmit={submit} className="border border-gray-200 rounded-lg p-3 space-y-2">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nueva zona</p>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Recepción" className={inp} />
      <div className="flex flex-wrap gap-1.5">
        {COLORS.map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)}
            className={`w-6 h-6 rounded border-2 ${color === c ? 'border-blue-500 scale-110' : 'border-gray-200'}`}
            style={{ background: c }} />
        ))}
      </div>
      <button type="submit" className="w-full bg-blue-600 text-white text-sm py-1.5 rounded hover:bg-blue-700">
        Crear zona
      </button>
    </form>
  )
}

function UbicacionForm() {
  const zonas = useDataStore((s) => s.zonas)
  const addUbicacion = useDataStore((s) => s.addUbicacion)
  const [codigo, setCodigo] = useState('')
  const [tipo, setTipo] = useState('rack')
  const [niveles, setNiveles] = useState(4)
  const [zonaId, setZonaId] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!codigo.trim()) return toast.error('Código requerido')
    const ok = await addUbicacion({
      codigo: codigo.trim(),
      tipo,
      niveles: tipo === 'piso' ? 1 : Number(niveles),
      zona_id: zonaId ? Number(zonaId) : null,
    })
    if (ok) { setCodigo(''); setNiveles(4) }
  }

  return (
    <form onSubmit={submit} className="border border-gray-200 rounded-lg p-3 space-y-2">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nueva ubicación</p>
      <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej: E-01, P-05" className={inp} />
      <div className="grid grid-cols-2 gap-2">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inp}>
          <option value="rack">Estantería</option>
          <option value="piso">Piso (paleta)</option>
        </select>
        <input
          type="number" min={1} max={10}
          value={tipo === 'piso' ? 1 : niveles}
          disabled={tipo === 'piso'}
          onChange={(e) => setNiveles(e.target.value)}
          placeholder="Niveles"
          className={`${inp} ${tipo === 'piso' ? 'bg-gray-100' : ''}`}
        />
      </div>
      <select value={zonaId} onChange={(e) => setZonaId(e.target.value)} className={inp}>
        <option value="">Sin zona</option>
        {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
      </select>
      <button type="submit" className="w-full bg-blue-600 text-white text-sm py-1.5 rounded hover:bg-blue-700">
        Crear ubicación
      </button>
      <p className="text-xs text-gray-400">Después arrástrala al canvas para posicionarla.</p>
    </form>
  )
}

// ── Lists ──────────────────────────────────────────────────────────────────

function UnplacedList() {
  const unplaced = useDataStore(useShallow(unplacedUbicacionesSelector))
  if (unplaced.length === 0) return null
  return (
    <div className="border border-orange-200 bg-orange-50 rounded-lg p-3">
      <p className="text-xs font-medium text-orange-700 mb-2">Sin posicionar ({unplaced.length})</p>
      <div className="space-y-1.5">
        {unplaced.map((u) => (
          <div
            key={u.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/x-ubicacion-id', String(u.id))}
            className="bg-white border border-orange-200 rounded px-2.5 py-1.5 text-sm cursor-grab active:cursor-grabbing hover:bg-orange-50"
          >
            <span className="font-medium text-gray-800">{u.codigo}</span>
            <span className="text-xs text-gray-500 ml-2">
              {u.tipo === 'rack' ? `Rack ${u.niveles}N` : 'Piso'}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-orange-600 mt-2">Arrastra al canvas →</p>
    </div>
  )
}

function ListItem({ children, selected, onClick, onRemove }) {
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
      selected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
    }`}>
      <button onClick={onClick} className="flex-1 text-left">{children}</button>
      {onRemove && (
        <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">×</button>
      )}
    </div>
  )
}

const ZonasList = memo(function ZonasList() {
  const zonas = useDataStore((s) => s.zonas)
  const editMode = useCanvasStore((s) => s.editMode)
  const selection = useCanvasStore((s) => s.selection)
  const select = useCanvasStore((s) => s.selectZona)
  const removeZona = useDataStore((s) => s.removeZona)
  const clearSelection = useCanvasStore((s) => s.clearSelection)

  const handleRemove = async (id) => {
    if (!window.confirm('¿Eliminar esta zona?')) return
    await removeZona(id)
    if (selection?.type === 'zona' && selection.id === id) clearSelection()
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Zonas ({zonas.length})
      </p>
      <div className="space-y-0.5 max-h-72 overflow-y-auto">
        {zonas.map((z) => (
          <ListItem
            key={z.id}
            selected={selection?.type === 'zona' && selection.id === z.id}
            onClick={() => select(z.id)}
            onRemove={editMode ? () => handleRemove(z.id) : null}
          >
            <span className="inline-block w-3 h-3 rounded mr-2 align-middle"
              style={{ background: z.color, border: '1px solid #CBD5E1' }} />
            <span className="font-medium">{z.nombre}</span>
          </ListItem>
        ))}
        {zonas.length === 0 && (
          <p className="text-xs text-gray-400 py-2">Sin zonas creadas</p>
        )}
      </div>
    </div>
  )
})

const UbicacionesList = memo(function UbicacionesList() {
  const placedUbicaciones = useDataStore(
    useShallow((s) => s.ubicaciones.filter((u) => u.x != null))
  )
  const editMode = useCanvasStore((s) => s.editMode)
  const selection = useCanvasStore((s) => s.selection)
  const select = useCanvasStore((s) => s.selectUbicacion)
  const removeUbicacion = useDataStore((s) => s.removeUbicacion)
  const clearSelection = useCanvasStore((s) => s.clearSelection)

  const handleRemove = async (id) => {
    if (!window.confirm('¿Eliminar esta ubicación?')) return
    await removeUbicacion(id)
    if (selection?.type === 'ubicacion' && selection.id === id) clearSelection()
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Ubicaciones ({placedUbicaciones.length} en mapa)
      </p>
      <div className="space-y-0.5 max-h-72 overflow-y-auto">
        {placedUbicaciones.map((u) => (
          <ListItem
            key={u.id}
            selected={selection?.type === 'ubicacion' && selection.id === u.id}
            onClick={() => select(u.id)}
            onRemove={editMode ? () => handleRemove(u.id) : null}
          >
            <span className="font-medium">{u.codigo}</span>
            <span className="text-xs text-gray-400 ml-2">
              {u.tipo === 'rack' ? `${u.niveles}N` : 'piso'}
              {u.zona && ` · ${u.zona}`}
            </span>
          </ListItem>
        ))}
      </div>
    </div>
  )
})

// ── Inventario panel — uses elevation view for racks ──────────────────────

function InventarioPanel() {
  const selection = useCanvasStore((s) => s.selection)
  const ubicacion = useDataStore(
    (s) => selection?.type === 'ubicacion' ? s.ubicaciones.find((u) => u.id === selection.id) : null
  )
  const zona = useDataStore(
    (s) => selection?.type === 'zona' ? s.zonas.find((z) => z.id === selection.id) : null
  )
  const ubicacionesEnZona = useDataStore(
    useShallow((s) => zona ? s.ubicaciones.filter((u) => u.zona_id === zona.id) : [])
  )
  const slotLotes = useDataStore(useShallow((s) => {
    if (!ubicacion) return []
    const nivel = selection.nivel ?? 0
    return s.stock.slots[`${ubicacion.id}:${ubicacion.tipo === 'rack' ? nivel : 0}`] ?? []
  }))
  const refreshStock = useDataStore((s) => s.refreshStock)

  const [asignando, setAsignando] = useState(false)

  const detachLote = async (lote) => {
    try {
      await ubicarLote(lote.id, { ubicacion_id: null })
      toast.success('Lote retirado')
      refreshStock()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error')
    }
  }

  if (!selection) {
    return (
      <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-400">
        Click en una zona o ubicación del mapa
      </div>
    )
  }

  if (zona) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded" style={{ background: zona.color, border: '1px solid #CBD5E1' }} />
          <p className="font-semibold text-gray-800">{zona.nombre}</p>
        </div>
        <p className="text-xs text-gray-500">{ubicacionesEnZona.length} ubicación(es)</p>
        <div className="space-y-1">
          {ubicacionesEnZona.map((u) => (
            <div key={u.id} className="text-xs border-l-2 border-gray-200 pl-2">
              <span className="font-medium">{u.codigo}</span>
              <span className="text-gray-400 ml-2">
                {u.tipo === 'rack' ? `${u.niveles} niveles` : 'piso'}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!ubicacion) return null

  const isRack = ubicacion.tipo === 'rack'
  const slotLabel = isRack
    ? (selection.nivel ? `Nivel N${selection.nivel}` : 'Selecciona un nivel')
    : 'Piso'
  const canAssign = !isRack || selection.nivel != null

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4">
      <div>
        <p className="font-semibold text-gray-800">{ubicacion.codigo}</p>
        <p className="text-xs text-gray-500">
          {isRack ? `Estantería · ${ubicacion.niveles} niveles` : 'Piso (paleta)'}
          {ubicacion.zona && ` · ${ubicacion.zona}`}
        </p>
      </div>

      {isRack && <RackElevation ubicacion={ubicacion} />}

      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-700">{slotLabel}</p>
          {canAssign && (
            <button
              onClick={() => setAsignando(true)}
              className="text-xs text-blue-600 hover:underline"
            >
              + Asignar lotes
            </button>
          )}
        </div>
        {!canAssign ? (
          <p className="text-xs text-gray-400">Click en un nivel del alzado arriba</p>
        ) : slotLotes.length === 0 ? (
          <p className="text-xs text-gray-400">Sin lotes en este slot</p>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {slotLotes.map((l) => (
              <div key={l.id} className="text-xs flex items-start gap-2 group bg-gray-50 rounded p-1.5">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{l.descripcion}</p>
                  <p className="text-gray-500">
                    {l.codigo} · {l.cantidad_bultos}b · {l.cantidad_unidades}u
                    {l.fecha_vencimiento && (
                      <span className={
                        new Date(l.fecha_vencimiento) < new Date(Date.now() + 30 * 86400000)
                          ? ' text-orange-500 ml-1' : ' text-gray-400 ml-1'
                      }>
                        vence {l.fecha_vencimiento}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => detachLote(l)}
                  className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                  title="Quitar de este slot"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {asignando && canAssign && (
        <AsignarLotes
          ubicacion={ubicacion}
          nivel={isRack ? selection.nivel : null}
          onAssigned={refreshStock}
          onClose={() => setAsignando(false)}
        />
      )}
    </div>
  )
}

// ── Sidebar shell ─────────────────────────────────────────────────────────

export default function PlannerSidebar() {
  const editMode = useCanvasStore((s) => s.editMode)
  const [tab, setTab] = useState('inventario')

  const tabBtn = (key, label, icon) => (
    <button
      onClick={() => setTab(key)}
      className={`flex-1 text-xs py-1.5 rounded transition-colors ${
        tab === key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
      }`}
    >
      {icon} {label}
    </button>
  )

  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {tabBtn('inventario', 'Inventario', '📦')}
        {tabBtn('ubicaciones', 'Ubicaciones', '🗄')}
        {tabBtn('zonas', 'Zonas', '🏷')}
      </div>

      {tab === 'inventario' && <InventarioPanel />}

      {tab === 'ubicaciones' && (
        <>
          {editMode && <UbicacionForm />}
          <UnplacedList />
          <UbicacionesList />
        </>
      )}

      {tab === 'zonas' && (
        <>
          {editMode && <ZonaForm />}
          <ZonasList />
        </>
      )}
    </div>
  )
}
