import { useEffect, useRef } from 'react'
import { Group, Rect, Text, Transformer } from 'react-konva'

export default function ZonaShape({ zona, selected, editMode, onSelect, onChange }) {
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
        onClick={(e) => { e.cancelBubble = true; onSelect(zona.id) }}
        onTap={(e) => { e.cancelBubble = true; onSelect(zona.id) }}
        onDragEnd={(e) => onChange(zona.id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) })}
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
            onChange(zona.id, {
              x: Math.round(parent.x()),
              y: Math.round(parent.y()),
              width: Math.round(Math.max(80, node.width() * node.scaleX())),
              height: Math.round(Math.max(60, node.height() * node.scaleY())),
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
