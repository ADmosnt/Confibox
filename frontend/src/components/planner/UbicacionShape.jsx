import { memo, useEffect, useRef, useState } from 'react'
import { Group, Rect, Text, Transformer, Line } from 'react-konva'
import { toast } from 'sonner'
import { useDataStore, useCanvasStore } from '../../stores/almacenStore'
import { aabbOverlap, isContainedIn } from '../../utils/aabb'

// PLAN VIEW ONLY — top-down orthographic.
// Levels (Z-axis) are rendered in the sidebar's RackElevation component when selected.

const THEME = {
  rack:  { fill: '#FCD34D', stroke: '#92400E' },   // amber — estantería
  piso:  { fill: '#A5B4FC', stroke: '#3730A3' },   // indigo — paleta
  suelo: { fill: '#BBF7D0', stroke: '#15803D' },   // green  — suelo
}

function UbicacionShape({ id }) {
  const ubicacion = useDataStore((s) => s.ubicaciones.find((u) => u.id === id))
  const totalLotes = useDataStore((s) => {
    if (!ubicacion) return 0
    let n = 0
    if (ubicacion.tipo === 'rack') {
      for (let nivel = 1; nivel <= ubicacion.niveles; nivel++) {
        n += (s.stock.slots[`${id}:${nivel}`] ?? []).length
      }
    } else {
      n = (s.stock.slots[`${id}:0`] ?? []).length
    }
    return n
  })
  const selected = useCanvasStore((s) => s.selection?.type === 'ubicacion' && s.selection.id === id)
  const editMode = useCanvasStore((s) => s.editMode)
  const select = useCanvasStore((s) => s.selectUbicacion)
  const patchUbicacion = useDataStore((s) => s.patchUbicacion)

  const rectRef = useRef()
  const trRef = useRef()
  const [isColliding, setIsColliding] = useState(false)

  useEffect(() => {
    if (selected && editMode && trRef.current && rectRef.current) {
      trRef.current.nodes([rectRef.current])
      trRef.current.getLayer().batchDraw()
    }
  }, [selected, editMode])

  if (!ubicacion || ubicacion.x == null) return null

  const w = ubicacion.width
  const h = ubicacion.height
  const rot = ubicacion.rotacion ?? 0
  const theme = THEME[ubicacion.tipo] ?? THEME.piso
  const strokeColor = isColliding ? '#DC2626' : (selected ? '#2563EB' : theme.stroke)
  const gridSize = useCanvasStore.getState().gridSize ?? 25
  const snapG = (n) => Math.round(n / gridSize) * gridSize

  const handleDragMove = (e) => {
    const { x, y } = e.target.position()
    const all = useDataStore.getState().ubicaciones
    const collides = all.some((other) => {
      if (other.id === id || other.x == null) return false
      return aabbOverlap(
        { x, y, w, h, rot },
        { x: other.x, y: other.y, w: other.width, h: other.height, rot: other.rotacion ?? 0 },
      )
    })
    setIsColliding(collides)
  }

  const handleDragEnd = (e) => {
    const newX = Math.max(0, snapG(e.target.x()))
    const newY = Math.max(0, snapG(e.target.y()))

    // Re-check collision at snapped position
    const all = useDataStore.getState().ubicaciones
    const collidesSnapped = all.some((other) => {
      if (other.id === id || other.x == null) return false
      return aabbOverlap(
        { x: newX, y: newY, w, h, rot },
        { x: other.x, y: other.y, w: other.width, h: other.height, rot: other.rotacion ?? 0 },
      )
    })

    if (collidesSnapped) {
      e.target.x(ubicacion.x)
      e.target.y(ubicacion.y)
      setIsColliding(false)
      toast.error('Posición ocupada — otra ubicación está ahí')
      return
    }

    // Zone containment check
    if (ubicacion.zona_id) {
      const zona = useDataStore.getState().zonas.find((z) => z.id === ubicacion.zona_id)
      if (zona && !isContainedIn({ x: newX, y: newY, w, h, rot }, zona)) {
        e.target.x(ubicacion.x)
        e.target.y(ubicacion.y)
        setIsColliding(false)
        toast.error(`Debe permanecer dentro de "${zona.nombre}"`)
        return
      }
    }

    setIsColliding(false)
    patchUbicacion(id, { x: newX, y: newY })
  }

  const etiquetas = ubicacion.etiquetas ?? []

  return (
    <>
      <Group
        x={ubicacion.x}
        y={ubicacion.y}
        rotation={rot}
        draggable={editMode}
        onClick={(e) => { e.cancelBubble = true; select(id, null) }}
        onTap={(e) => { e.cancelBubble = true; select(id, null) }}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        <Rect
          ref={rectRef}
          width={w}
          height={h}
          fill={theme.fill}
          stroke={strokeColor}
          strokeWidth={selected || isColliding ? 2.5 : 1.5}
          cornerRadius={3}
          shadowColor="black"
          shadowBlur={selected ? 8 : 3}
          shadowOpacity={selected ? 0.25 : 0.12}
          onTransformEnd={() => {
            const node = rectRef.current
            const parent = node.getParent()
            patchUbicacion(id, {
              x: snapG(parent.x()),
              y: snapG(parent.y()),
              width: snapG(Math.max(40, node.width() * node.scaleX())),
              height: snapG(Math.max(40, node.height() * node.scaleY())),
            })
            node.scaleX(1); node.scaleY(1)
          }}
        />

        {/* Rack indicator: 3 horizontal lines in top-left corner */}
        {ubicacion.tipo === 'rack' && (
          <>
            <Line points={[6, 8, 22, 8]} stroke={theme.stroke} strokeWidth={1.5} listening={false} />
            <Line points={[6, 12, 22, 12]} stroke={theme.stroke} strokeWidth={1.5} listening={false} />
            <Line points={[6, 16, 22, 16]} stroke={theme.stroke} strokeWidth={1.5} listening={false} />
          </>
        )}

        {/* Suelo indicator: diagonal hatch in bottom-left corner */}
        {ubicacion.tipo === 'suelo' && (
          <>
            <Line points={[4, h - 4, h - 4, 4]} stroke={theme.stroke} strokeWidth={1} opacity={0.5} listening={false} />
          </>
        )}

        <Text
          text={ubicacion.codigo}
          width={w}
          y={h / 2 - 7}
          align="center"
          fontSize={12}
          fontStyle="bold"
          fill="#1E293B"
          listening={false}
        />

        {ubicacion.tipo === 'rack' && (
          <Text
            text={`${ubicacion.niveles}N`}
            width={w}
            y={h - 14}
            align="center"
            fontSize={9}
            fill="#78716C"
            listening={false}
          />
        )}

        {/* Stock badge (top-right) */}
        {totalLotes > 0 && (
          <Group x={w - 22} y={2}>
            <Rect width={18} height={18} fill="#2563EB" cornerRadius={9} />
            <Text
              text={String(totalLotes)}
              width={18} height={18}
              align="center" verticalAlign="middle"
              fontSize={9} fontStyle="bold" fill="white"
              listening={false}
            />
          </Group>
        )}

        {/* Etiqueta dots — bottom row, left-aligned */}
        {etiquetas.slice(0, 5).map((et, i) => (
          <Rect
            key={et.id}
            x={4 + i * 10}
            y={h - 8}
            width={8}
            height={5}
            fill={et.color}
            stroke="#94A3B8"
            strokeWidth={0.5}
            cornerRadius={1}
            listening={false}
          />
        ))}
      </Group>

      {selected && editMode && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          boundBoxFunc={(oldBox, newBox) => ({
            ...newBox,
            width: Math.max(40, newBox.width),
            height: Math.max(40, newBox.height),
          })}
        />
      )}
    </>
  )
}

export default memo(UbicacionShape)
