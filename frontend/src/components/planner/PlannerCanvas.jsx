import { useEffect, useRef, useState } from 'react'
import { Stage, Layer } from 'react-konva'
import ZonaShape from './ZonaShape'
import UbicacionShape from './UbicacionShape'
import {
  useDataStore, useCanvasStore,
  placedUbicacionIdsSelector, zonaIdsSelector, useShallow,
} from '../../stores/almacenStore'

const CANVAS_W = 1200
const CANVAS_H = 700
const GRID = 25

// CSS dot-grid background — rendered by the GPU as a single repeating pattern.
// Replaces the previous Konva-Rect grid (~1300 nodes) with O(1) cost.
const gridStyle = {
  backgroundColor: '#F8FAFC',
  backgroundImage: 'radial-gradient(circle, #CBD5E1 1px, transparent 1px)',
  backgroundSize: `${GRID}px ${GRID}px`,
  backgroundPosition: '0 0',
}

function snap(n) { return Math.round(n / GRID) * GRID }

// Convert client (clientX, clientY) into Konva world coords using the stage's
// own transform — handles scale, pan, and zoom natively without magic numbers.
function clientToWorld(stage, clientX, clientY) {
  const rect = stage.container().getBoundingClientRect()
  const transform = stage.getAbsoluteTransform().copy().invert()
  return transform.point({ x: clientX - rect.left, y: clientY - rect.top })
}

export default function PlannerCanvas() {
  const stageRef = useRef()
  const containerRef = useRef()
  const [scale, setScale] = useState(1)

  // Subscribe ONLY to ID lists (shallow comparison) — when a ubicacion's
  // position changes, this parent does NOT re-render because the IDs are stable.
  const zonaIds = useDataStore(useShallow(zonaIdsSelector))
  const ubicacionIds = useDataStore(useShallow(placedUbicacionIdsSelector))
  const editMode = useCanvasStore((s) => s.editMode)
  const clearSelection = useCanvasStore((s) => s.clearSelection)

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return
      const w = containerRef.current.offsetWidth
      setScale(Math.min(1, w / CANVAS_W))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const handleStageClick = (e) => {
    if (e.target === e.target.getStage()) clearSelection()
  }

  const handleNativeDrop = (e) => {
    e.preventDefault()
    if (!editMode) return
    const id = Number(e.dataTransfer.getData('text/x-ubicacion-id'))
    if (!id) return

    const stage = stageRef.current
    if (!stage) return

    // Read the ubicacion's actual size from the store — no hardcoded offsets.
    const u = useDataStore.getState().ubicaciones.find((uu) => uu.id === id)
    if (!u) return

    const world = clientToWorld(stage, e.clientX, e.clientY)
    // Center the ubicacion on the cursor using ITS OWN size
    const x = Math.max(0, snap(world.x - u.width / 2))
    const y = Math.max(0, snap(world.y - u.height / 2))
    useDataStore.getState().patchUbicacion(id, { x, y })
    useCanvasStore.getState().selectUbicacion(id)
  }

  return (
    <div
      ref={containerRef}
      className="border border-gray-200 rounded-lg overflow-hidden"
      style={{ ...gridStyle, touchAction: 'none' }}
      onDragOver={(e) => editMode && e.preventDefault()}
      onDrop={handleNativeDrop}
    >
      <Stage
        ref={stageRef}
        width={CANVAS_W * scale}
        height={CANVAS_H * scale}
        scaleX={scale}
        scaleY={scale}
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
  )
}
