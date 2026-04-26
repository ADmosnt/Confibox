import { useEffect, useRef, useState, useCallback } from 'react'
import { Stage, Layer, Rect, Text, Transformer, Group } from 'react-konva'
import { toast } from 'sonner'
import { getAlmacenLayout, saveAlmacenLayout, getStockPorZona } from '../api'

const CANVAS_W = 1000
const CANVAS_H = 650
const ZONA_COLORS = [
  '#DBEAFE', '#D1FAE5', '#FEF3C7', '#FCE7F3', '#EDE9FE',
  '#FFEDD5', '#CFFAFE', '#E0E7FF', '#F0FDF4', '#FFF7ED',
]
const DEFAULT_ZONA = { width: 140, height: 100 }
let _uid = 1
const uid = () => `z${_uid++}`

function ZonaShape({ zona, selected, editMode, onSelect, onChange }) {
  const rectRef = useRef()
  const trRef = useRef()

  useEffect(() => {
    if (selected && editMode && trRef.current && rectRef.current) {
      trRef.current.nodes([rectRef.current])
      trRef.current.getLayer().batchDraw()
    }
  }, [selected, editMode])

  return (
    <>
      <Group
        x={zona.x}
        y={zona.y}
        draggable={editMode}
        onClick={() => onSelect(zona.id)}
        onTap={() => onSelect(zona.id)}
        onDragEnd={(e) => onChange(zona.id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) })}
      >
        <Rect
          ref={rectRef}
          width={zona.width}
          height={zona.height}
          fill={zona.color}
          stroke={selected ? '#2563EB' : '#94A3B8'}
          strokeWidth={selected ? 2 : 1}
          cornerRadius={6}
          onTransformEnd={() => {
            const node = rectRef.current
            onChange(zona.id, {
              x: Math.round(node.x() + (node.parent?.x() ?? 0)),
              y: Math.round(node.y() + (node.parent?.y() ?? 0)),
              width: Math.round(Math.max(60, node.width() * node.scaleX())),
              height: Math.round(Math.max(40, node.height() * node.scaleY())),
            })
            node.scaleX(1)
            node.scaleY(1)
          }}
        />
        <Text
          text={zona.nombre}
          width={zona.width}
          height={zona.height}
          align="center"
          verticalAlign="middle"
          fontSize={12}
          fontStyle="bold"
          fill="#1E293B"
          listening={false}
          wrap="word"
          padding={6}
        />
        {zona._count > 0 && (
          <Group x={zona.width - 22} y={6}>
            <Rect width={18} height={18} fill="#2563EB" cornerRadius={9} />
            <Text
              text={String(zona._count)}
              width={18}
              height={18}
              align="center"
              verticalAlign="middle"
              fontSize={9}
              fontStyle="bold"
              fill="white"
              listening={false}
            />
          </Group>
        )}
      </Group>
      {selected && editMode && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          boundBoxFunc={(oldBox, newBox) => ({
            ...newBox,
            width: Math.max(60, newBox.width),
            height: Math.max(40, newBox.height),
          })}
        />
      )}
    </>
  )
}

export default function AlmacenPlanner() {
  const [zonas, setZonas] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [stockPorZona, setStockPorZona] = useState({})
  const [panelZona, setPanelZona] = useState(null)
  const [editNombre, setEditNombre] = useState('')
  const [editColor, setEditColor] = useState('')
  const containerRef = useRef()
  const [scale, setScale] = useState(1)

  // Responsive scale
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth
        setScale(Math.min(1, w / CANVAS_W))
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const loadAll = useCallback(async () => {
    try {
      const [layoutRes, stockRes] = await Promise.all([getAlmacenLayout(), getStockPorZona()])
      const layout = layoutRes.data.layout ?? {}
      const rawZonas = layout.zonas ?? []
      const stock = stockRes.data
      setStockPorZona(stock)
      setZonas(rawZonas.map((z) => ({ ...z, _count: (stock[z.nombre] ?? []).length })))
    } catch {
      toast.error('Error cargando el planner')
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const save = async () => {
    setSaving(true)
    try {
      const clean = zonas.map(({ _count, ...z }) => z)
      await saveAlmacenLayout({ zonas: clean, canvas: { width: CANVAS_W, height: CANVAS_H } })
      toast.success('Plano guardado')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const addZona = () => {
    const id = uid()
    const color = ZONA_COLORS[zonas.length % ZONA_COLORS.length]
    setZonas((z) => [
      ...z,
      { id, nombre: `Zona ${zonas.length + 1}`, color, x: 40, y: 40, ...DEFAULT_ZONA, _count: 0 },
    ])
    setSelectedId(id)
  }

  const removeSelected = () => {
    setZonas((z) => z.filter((z) => z.id !== selectedId))
    setSelectedId(null)
    setPanelZona(null)
  }

  const updateZona = (id, patch) => {
    setZonas((prev) => prev.map((z) => z.id === id ? { ...z, ...patch } : z))
  }

  const handleSelect = (id) => {
    setSelectedId(id)
    if (!editMode) {
      const z = zonas.find((z) => z.id === id)
      setPanelZona(z ?? null)
    } else {
      const z = zonas.find((z) => z.id === id)
      setEditNombre(z?.nombre ?? '')
      setEditColor(z?.color ?? ZONA_COLORS[0])
      setPanelZona(z ?? null)
    }
  }

  const applyEdit = () => {
    if (!selectedId) return
    updateZona(selectedId, { nombre: editNombre, color: editColor })
    setPanelZona((p) => p ? { ...p, nombre: editNombre, color: editColor } : null)
    toast.success('Zona actualizada')
  }

  const deselect = (e) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null)
      setPanelZona(null)
    }
  }

  const selectedZona = zonas.find((z) => z.id === selectedId)
  const inventarioZona = panelZona ? (stockPorZona[panelZona.nombre] ?? []) : []

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-800">Planner de Almacén</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditMode((v) => !v); setSelectedId(null); setPanelZona(null) }}
            className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              editMode
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {editMode ? '✏️ Diseño' : '👁 Ver inventario'}
          </button>
          {editMode && (
            <>
              <button
                onClick={addZona}
                className="text-sm px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700"
              >
                + Zona
              </button>
              {selectedId && (
                <button
                  onClick={removeSelected}
                  className="text-sm px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                >
                  Eliminar
                </button>
              )}
              <button
                onClick={save}
                disabled={saving}
                className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar plano'}
              </button>
            </>
          )}
          {!editMode && (
            <button onClick={loadAll} className="text-sm text-blue-600 hover:underline">
              Actualizar
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Canvas */}
        <div className="flex-1 min-w-0">
          <div
            ref={containerRef}
            className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden"
            style={{ touchAction: 'none' }}
          >
            {zonas.length === 0 && !editMode && (
              <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                No hay zonas definidas. Activa el modo Diseño para crear el plano.
              </div>
            )}
            <Stage
              width={CANVAS_W * scale}
              height={CANVAS_H * scale}
              scaleX={scale}
              scaleY={scale}
              onMouseDown={deselect}
              onTouchStart={deselect}
            >
              <Layer>
                {/* Grid background */}
                {Array.from({ length: Math.ceil(CANVAS_W / 50) + 1 }, (_, i) => (
                  <Rect
                    key={`vg${i}`}
                    x={i * 50} y={0} width={1} height={CANVAS_H}
                    fill="#E2E8F0" listening={false}
                  />
                ))}
                {Array.from({ length: Math.ceil(CANVAS_H / 50) + 1 }, (_, i) => (
                  <Rect
                    key={`hg${i}`}
                    x={0} y={i * 50} width={CANVAS_W} height={1}
                    fill="#E2E8F0" listening={false}
                  />
                ))}

                {zonas.map((zona) => (
                  <ZonaShape
                    key={zona.id}
                    zona={zona}
                    selected={selectedId === zona.id}
                    editMode={editMode}
                    onSelect={handleSelect}
                    onChange={updateZona}
                  />
                ))}
              </Layer>
            </Stage>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {editMode
              ? 'Arrastra zonas para moverlas · Esquinas para redimensionar · Click para editar propiedades'
              : 'Click en una zona para ver su inventario'}
          </p>
        </div>

        {/* Side panel */}
        <div className="w-full lg:w-72 shrink-0 space-y-3">
          {editMode && selectedZona ? (
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <p className="font-semibold text-gray-700 text-sm">Editar zona</p>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nombre</label>
                <input
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  onBlur={applyEdit}
                  onKeyDown={(e) => e.key === 'Enter' && applyEdit()}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Color de fondo</label>
                <div className="flex flex-wrap gap-1.5">
                  {ZONA_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setEditColor(c); updateZona(selectedId, { color: c }) }}
                      className={`w-7 h-7 rounded border-2 transition-all ${
                        editColor === c ? 'border-blue-500 scale-110' : 'border-gray-200'
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="text-xs text-gray-400">
                {Math.round(selectedZona.width)} × {Math.round(selectedZona.height)} px
                · ({Math.round(selectedZona.x)}, {Math.round(selectedZona.y)})
              </div>
            </div>
          ) : !editMode && panelZona ? (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-4 h-4 rounded"
                  style={{ background: panelZona.color, border: '1px solid #CBD5E1' }}
                />
                <p className="font-semibold text-gray-800 text-sm">{panelZona.nombre}</p>
                <span className="ml-auto text-xs text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">
                  {inventarioZona.length} lote{inventarioZona.length !== 1 ? 's' : ''}
                </span>
              </div>
              {inventarioZona.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">Sin stock en esta zona</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {inventarioZona.map((lote) => (
                    <div key={lote.id} className="border border-gray-100 rounded p-2 text-xs">
                      <p className="font-medium text-gray-800">{lote.descripcion}</p>
                      <p className="text-gray-500">{lote.codigo} · {lote.cantidad_bultos} b · {lote.cantidad_unidades} u</p>
                      {lote.fecha_vencimiento && (
                        <p className={`mt-0.5 ${
                          new Date(lote.fecha_vencimiento) < new Date(Date.now() + 30 * 86400000)
                            ? 'text-orange-500'
                            : 'text-gray-400'
                        }`}>
                          Vence: {lote.fecha_vencimiento}
                        </p>
                      )}
                      {lote.numero_lote && <p className="text-gray-400">Lote: {lote.numero_lote}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-400">
              {editMode
                ? 'Selecciona una zona para editar sus propiedades'
                : 'Selecciona una zona para ver su inventario'}
            </div>
          )}

          {/* Zona list */}
          {zonas.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                Zonas ({zonas.length})
              </p>
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {zonas.map((z) => (
                  <button
                    key={z.id}
                    onClick={() => handleSelect(z.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
                      selectedId === z.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="w-3 h-3 rounded shrink-0" style={{ background: z.color, border: '1px solid #CBD5E1' }} />
                    <span className="flex-1 truncate">{z.nombre}</span>
                    {z._count > 0 && (
                      <span className="text-xs text-blue-500 shrink-0">{z._count}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
