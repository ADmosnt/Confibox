import { useEffect, useRef } from 'react'
import { Stage, Layer } from 'react-konva'
import { toast } from 'sonner'
import ZonaShape from './ZonaShape'
import UbicacionShape from './UbicacionShape'
import {
  useDataStore, useCanvasStore,
  placedUbicacionIdsSelector, zonaIdsSelector, useShallow,
} from '../../stores/almacenStore'
import { isContainedIn } from '../../utils/aabb'

const CANVAS_W = 1200
const CANVAS_H = 700
const ZOOM_MIN = 0.25
const ZOOM_MAX = 5

// CSS dot-grid background — O(1) GPU-rendered repeating pattern.
const gridStyle = {
  backgroundColor: '#F8FAFC',
  backgroundImage: 'radial-gradient(circle, #CBD5E1 1px, transparent 1px)',
  backgroundSize: '25px 25px',
  backgroundPosition: '0 0',
}

function clientToWorld(stage, clientX, clientY) {
  const rect = stage.container().getBoundingClientRect()
  const transform = stage.getAbsoluteTransform().copy().invert()
  return transform.point({ x: clientX - rect.left, y: clientY - rect.top })
}

export default function PlannerCanvas() {
  const stageRef = useRef()
  const containerRef = useRef()

  // containerScale: responsive scaling so canvas fits the flex column.
  // zoom/pan are managed imperatively via Konva to avoid re-rendering children.
  const containerScaleRef = useRef(1)
  const zoomRef = useRef(1)

  const zonaIds = useDataStore(useShallow(zonaIdsSelector))
  const ubicacionIds = useDataStore(useShallow(placedUbicacionIdsSelector))
  const editMode = useCanvasStore((s) => s.editMode)
  const clearSelection = useCanvasStore((s) => s.clearSelection)

  // ── Responsive fit ──────────────────────────────────────────────────────
  useEffect(() => {
    const measure = () => {
      if (!containerRef.current || !stageRef.current) return
      const w = containerRef.current.offsetWidth
      const cs = Math.min(1, w / CANVAS_W)
      containerScaleRef.current = cs
      const stage = stageRef.current
      // Preserve zoom when resizing: only adjust the base scale
      const currentZoom = zoomRef.current
      stage.width(CANVAS_W * cs)
      stage.height(CANVAS_H * cs)
      stage.scale({ x: cs * currentZoom, y: cs * currentZoom })
      stage.batchDraw()
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // ── R-key rotation ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.key !== 'r' && e.key !== 'R') || !useCanvasStore.getState().editMode) return
      const sel = useCanvasStore.getState().selection
      if (!sel || sel.type !== 'ubicacion') return
      const u = useDataStore.getState().ubicaciones.find((u) => u.id === sel.id)
      if (!u) return
      useDataStore.getState().patchUbicacion(sel.id, { rotacion: ((u.rotacion ?? 0) + 90) % 360 })
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // ── Wheel zoom (cursor-anchored) ────────────────────────────────────────
  const handleWheel = (e) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const cs = containerScaleRef.current
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    const scaleBy = 1.1
    const rawZoom = e.evt.deltaY < 0 ? zoomRef.current * scaleBy : zoomRef.current / scaleBy
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, rawZoom))
    const newScale = cs * newZoom
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }
    zoomRef.current = newZoom
    stage.scale({ x: newScale, y: newScale })
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    })
    stage.batchDraw()
  }

  const resetView = () => {
    const stage = stageRef.current
    if (!stage) return
    const cs = containerScaleRef.current
    zoomRef.current = 1
    stage.scale({ x: cs, y: cs })
    stage.position({ x: 0, y: 0 })
    stage.batchDraw()
  }

  // ── Stage click (deselect on background) ───────────────────────────────
  const handleStageClick = (e) => {
    if (e.target === e.target.getStage()) clearSelection()
  }

  // ── Drop from sidebar unplaced list ─────────────────────────────────────
  const handleNativeDrop = (e) => {
    e.preventDefault()
    if (!editMode) return
    const id = Number(e.dataTransfer.getData('text/x-ubicacion-id'))
    if (!id) return
    const stage = stageRef.current
    if (!stage) return
    const u = useDataStore.getState().ubicaciones.find((uu) => uu.id === id)
    if (!u) return
    const gridSize = useCanvasStore.getState().gridSize ?? 25
    const snap = (n) => Math.round(n / gridSize) * gridSize
    const world = clientToWorld(stage, e.clientX, e.clientY)
    const x = Math.max(0, snap(world.x - u.width / 2))
    const y = Math.max(0, snap(world.y - u.height / 2))

    // Zone containment for drop
    if (u.zona_id) {
      const zona = useDataStore.getState().zonas.find((z) => z.id === u.zona_id)
      if (zona && !isContainedIn({ x, y, w: u.width, h: u.height, rot: u.rotacion ?? 0 }, zona)) {
        toast.error(`Esta ubicación pertenece a "${zona.nombre}" — suéltala dentro de esa zona`)
        return
      }
    }

    useDataStore.getState().patchUbicacion(id, { x, y })
    useCanvasStore.getState().selectUbicacion(id)
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="border border-gray-200 rounded-lg overflow-hidden"
        style={{ ...gridStyle, touchAction: 'none' }}
        onDragOver={(e) => editMode && e.preventDefault()}
        onDrop={handleNativeDrop}
      >
        <Stage
          ref={stageRef}
          width={CANVAS_W}
          height={CANVAS_H}
          draggable={!editMode}
          onWheel={handleWheel}
          onMouseDown={handleStageClick}
          onTouchStart={handleStageClick}
        >
          <Layer>
            {zonaIds.map((id) => <ZonaShape key={id} id={id} />)}
          </Layer>
          <Layer>
            {ubicacionIds.map((id) => <UbicacionShape key={id} id={id} />)}
          </Layer>
        </Stage>
      </div>
      {/* Reset-zoom pill — only shown when zoomed */}
      <button
        onClick={resetView}
        className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full px-2.5 py-1 text-xs text-gray-600 hover:bg-white shadow-sm"
        title="Restablecer zoom (Ctrl+0)"
      >
        ⊙ 1:1
      </button>
    </div>
  )
}
