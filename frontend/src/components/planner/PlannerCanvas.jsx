import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Rect, Text } from 'react-konva'
import ZonaShape from './ZonaShape'
import UbicacionShape from './UbicacionShape'

const CANVAS_W = 1200
const CANVAS_H = 700
const GRID = 25

function GridBackground() {
  // Render grid as a single set of light dots — much cheaper than full lines
  const dots = []
  for (let x = 0; x <= CANVAS_W; x += GRID) {
    for (let y = 0; y <= CANVAS_H; y += GRID) {
      dots.push({ x, y })
    }
  }
  return (
    <>
      <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#F8FAFC" listening={false} />
      {dots.map((d, i) => (
        <Rect key={i} x={d.x} y={d.y} width={1} height={1} fill="#CBD5E1" listening={false} />
      ))}
    </>
  )
}

export default function PlannerCanvas({
  zonas, ubicaciones, stockBySlot,
  selection, onSelect, onMoveZona, onMoveUbicacion,
  editMode, onDropFromSidebar,
}) {
  const containerRef = useRef()
  const [scale, setScale] = useState(1)

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

  // Snap to GRID when dragging
  const snap = (val) => Math.round(val / GRID) * GRID

  const handleStageClick = (e) => {
    if (e.target === e.target.getStage()) onSelect(null)
  }

  // Native HTML5 drop handler — sidebar drags an ubicacion id onto the canvas
  const handleNativeDrop = (e) => {
    e.preventDefault()
    if (!editMode) return
    const id = Number(e.dataTransfer.getData('text/x-ubicacion-id'))
    if (!id) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = snap((e.clientX - rect.left) / scale - 40)
    const y = snap((e.clientY - rect.top) / scale - 30)
    onDropFromSidebar(id, { x: Math.max(0, x), y: Math.max(0, y) })
  }

  return (
    <div
      ref={containerRef}
      className="bg-white border border-gray-200 rounded-lg overflow-hidden"
      style={{ touchAction: 'none' }}
      onDragOver={(e) => editMode && e.preventDefault()}
      onDrop={handleNativeDrop}
    >
      <Stage
        width={CANVAS_W * scale}
        height={CANVAS_H * scale}
        scaleX={scale}
        scaleY={scale}
        onMouseDown={handleStageClick}
        onTouchStart={handleStageClick}
      >
        <Layer listening={false}>
          <GridBackground />
        </Layer>

        {/* Zonas in their own layer — sit BEHIND ubicaciones */}
        <Layer>
          {zonas.map((z) => (
            <ZonaShape
              key={z.id}
              zona={z}
              selected={selection?.type === 'zona' && selection.id === z.id}
              editMode={editMode}
              onSelect={(id) => onSelect({ type: 'zona', id })}
              onChange={(id, patch) => onMoveZona(id, {
                ...patch,
                ...(patch.x != null ? { x: snap(patch.x) } : {}),
                ...(patch.y != null ? { y: snap(patch.y) } : {}),
              })}
            />
          ))}
        </Layer>

        {/* Ubicaciones on top */}
        <Layer>
          {ubicaciones.filter((u) => u.x != null).map((u) => (
            <UbicacionShape
              key={u.id}
              ubicacion={u}
              selected={selection?.type === 'ubicacion' && selection.id === u.id}
              selectedNivel={selection?.type === 'ubicacion' && selection.id === u.id ? selection.nivel : null}
              editMode={editMode}
              stockBySlot={stockBySlot}
              onSelect={(id, nivel) => onSelect({ type: 'ubicacion', id, nivel })}
              onChange={(id, patch) => onMoveUbicacion(id, {
                ...patch,
                ...(patch.x != null ? { x: snap(patch.x) } : {}),
                ...(patch.y != null ? { y: snap(patch.y) } : {}),
              })}
            />
          ))}
          {ubicaciones.filter((u) => u.x != null).length === 0 && (
            <Text
              text="Arrastra ubicaciones desde el panel lateral para posicionarlas"
              x={CANVAS_W / 2 - 200}
              y={CANVAS_H / 2 - 8}
              fontSize={13}
              fill="#94A3B8"
              listening={false}
            />
          )}
        </Layer>
      </Stage>
    </div>
  )
}
