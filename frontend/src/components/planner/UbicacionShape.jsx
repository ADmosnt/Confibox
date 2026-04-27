import { memo, useEffect, useRef } from 'react'
import { Group, Rect, Text, Transformer, Line } from 'react-konva'
import { useDataStore, useCanvasStore } from '../../stores/almacenStore'

// PLAN VIEW ONLY — viewed from above (the ceiling).
// We do NOT draw vertical levels here. Levels (Z-axis) are rendered as an
// architectural elevation in the sidebar's RackElevation component when this
// ubicacion is selected. This is the correct CAD convention.

const RACK_FILL = '#FCD34D'
const RACK_STROKE = '#92400E'
const PISO_FILL = '#A5B4FC'
const PISO_STROKE = '#3730A3'

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

  useEffect(() => {
    if (selected && editMode && trRef.current && rectRef.current) {
      trRef.current.nodes([rectRef.current])
      trRef.current.getLayer().batchDraw()
    }
  }, [selected, editMode])

  if (!ubicacion || ubicacion.x == null) return null

  const w = ubicacion.width
  const h = ubicacion.height
  const isRack = ubicacion.tipo === 'rack'
  const fill = isRack ? RACK_FILL : PISO_FILL
  const stroke = selected ? '#2563EB' : (isRack ? RACK_STROKE : PISO_STROKE)
  const snap = (n) => Math.round(n / 25) * 25

  return (
    <>
      <Group
        x={ubicacion.x}
        y={ubicacion.y}
        rotation={ubicacion.rotacion ?? 0}
        draggable={editMode}
        onClick={(e) => { e.cancelBubble = true; select(id, null) }}
        onTap={(e) => { e.cancelBubble = true; select(id, null) }}
        onDragEnd={(e) => patchUbicacion(id, { x: snap(e.target.x()), y: snap(e.target.y()) })}
      >
        <Rect
          ref={rectRef}
          width={w}
          height={h}
          fill={fill}
          stroke={stroke}
          strokeWidth={selected ? 2.5 : 1.5}
          cornerRadius={3}
          shadowColor="black"
          shadowBlur={selected ? 8 : 3}
          shadowOpacity={selected ? 0.25 : 0.12}
          onTransformEnd={() => {
            const node = rectRef.current
            const parent = node.getParent()
            patchUbicacion(id, {
              x: snap(parent.x()),
              y: snap(parent.y()),
              width: snap(Math.max(40, node.width() * node.scaleX())),
              height: snap(Math.max(40, node.height() * node.scaleY())),
            })
            node.scaleX(1); node.scaleY(1)
          }}
        />

        {/* Visual cue: rack has a small "structure indicator" — three short
            parallel lines in the corner (stylized rack-from-above) */}
        {isRack && (
          <>
            <Line points={[6, 8, 22, 8]} stroke={RACK_STROKE} strokeWidth={1.5} listening={false} />
            <Line points={[6, 12, 22, 12]} stroke={RACK_STROKE} strokeWidth={1.5} listening={false} />
            <Line points={[6, 16, 22, 16]} stroke={RACK_STROKE} strokeWidth={1.5} listening={false} />
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

        {isRack && (
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

        {totalLotes > 0 && (
          <Group x={w - 22} y={h - 22}>
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
