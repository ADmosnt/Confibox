// Confibox/frontend/src/components/planner/ZonaShape.jsx
import { memo, useEffect, useRef } from 'react'
import { Group, Rect, Text, Transformer } from 'react-konva'
import { useDataStore, useCanvasStore } from '../../stores/almacenStore'

// Subscribes to its own zona slice — re-renders only when that zona changes.
// Other zonas stay at their old reference (immutable swap) so Zustand bails out.

function ZonaShape({ id }) {
  const zona = useDataStore((s) => s.zonas.find((z) => z.id === id))
  const selected = useCanvasStore((s) => s.selection?.type === 'zona' && s.selection.id === id)
  const editMode = useCanvasStore((s) => s.editMode)
  const select = useCanvasStore((s) => s.selectZona)
  const patchZona = useDataStore((s) => s.patchZona)

  const rectRef = useRef()
  const trRef = useRef()

  useEffect(() => {
    if (selected && editMode && trRef.current && rectRef.current) {
      trRef.current.nodes([rectRef.current])
      trRef.current.getLayer().batchDraw()
    }
  }, [selected, editMode])

  if (!zona) return null

  const snap = (n) => Math.round(n / 25) * 25

  return (
    <>
      <Group
        x={zona.x}
        y={zona.y}
        draggable={editMode}
        onClick={(e) => { e.cancelBubble = true; select(id) }}
        onTap={(e) => { e.cancelBubble = true; select(id) }}
        onDragEnd={(e) => patchZona(id, { x: snap(e.target.x()), y: snap(e.target.y()) })}
      >
        <Rect
          ref={rectRef}
          width={zona.width}
          height={zona.height}
          fill={zona.color}
          opacity={0.45}
          stroke={selected ? '#2563EB' : '#94A3B8'}
          strokeWidth={selected ? 2 : 1}
          dash={[6, 4]}
          cornerRadius={4}
          onTransformEnd={() => {
            const node = rectRef.current
            const parent = node.getParent()
            patchZona(id, {
              x: snap(parent.x()),
              y: snap(parent.y()),
              width: snap(Math.max(80, node.width() * node.scaleX())),
              height: snap(Math.max(60, node.height() * node.scaleY())),
            })
            node.scaleX(1); node.scaleY(1)
          }}
        />
        <Text
          text={zona.nombre}
          x={8} y={6}
          fontSize={11}
          fontStyle="bold"
          fill="#475569"
          listening={false}
        />
      </Group>
      {selected && editMode && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          boundBoxFunc={(oldBox, newBox) => ({
            ...newBox,
            width: Math.max(80, newBox.width),
            height: Math.max(60, newBox.height),
          })}
        />
      )}
    </>
  )
}

export default memo(ZonaShape)
