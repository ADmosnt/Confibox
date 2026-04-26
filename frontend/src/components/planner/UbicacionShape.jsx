import { useEffect, useRef } from 'react'
import { Group, Rect, Text, Line, Transformer } from 'react-konva'

const RACK_FILL = '#FEF3C7'
const PISO_FILL = '#E0E7FF'
const RACK_NIVEL_FONT = 9

export default function UbicacionShape({
  ubicacion, selected, selectedNivel, editMode, stockBySlot, onSelect, onChange,
}) {
  const rectRef = useRef()
  const trRef = useRef()
  const isRack = ubicacion.tipo === 'rack'

  useEffect(() => {
    if (selected && editMode && trRef.current && rectRef.current) {
      trRef.current.nodes([rectRef.current])
      trRef.current.getLayer().batchDraw()
    }
  }, [selected, editMode])

  if (ubicacion.x == null || ubicacion.y == null) return null

  const w = ubicacion.width
  const h = ubicacion.height
  const { codigo, niveles, id, rotacion = 0 } = ubicacion

  // Niveles drawn top → bottom: top of rectangle = highest nivel (N), bottom = N1
  const nivelHeight = isRack ? h / niveles : h

  return (
    <>
      <Group
        x={ubicacion.x}
        y={ubicacion.y}
        rotation={rotacion}
        draggable={editMode}
        onClick={(e) => { e.cancelBubble = true; onSelect(id, null) }}
        onTap={(e) => { e.cancelBubble = true; onSelect(id, null) }}
        onDragEnd={(e) => onChange(id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) })}
      >
        <Rect
          ref={rectRef}
          width={w}
          height={h}
          fill={isRack ? RACK_FILL : PISO_FILL}
          stroke={selected ? '#2563EB' : '#475569'}
          strokeWidth={selected ? 2 : 1}
          cornerRadius={3}
          shadowColor="black"
          shadowBlur={selected ? 8 : 3}
          shadowOpacity={selected ? 0.25 : 0.1}
          onTransformEnd={() => {
            const node = rectRef.current
            const parent = node.getParent()
            onChange(id, {
              x: Math.round(parent.x()),
              y: Math.round(parent.y()),
              width: Math.round(Math.max(40, node.width() * node.scaleX())),
              height: Math.round(Math.max(40, node.height() * node.scaleY())),
            })
            node.scaleX(1); node.scaleY(1)
          }}
        />

        {/* Rack level dividers + labels — top of rect is highest nivel */}
        {isRack && Array.from({ length: niveles }, (_, i) => {
          const nivel = niveles - i  // top→bottom: niveles, ..., 1
          const yTop = i * nivelHeight
          const slotKey = `${id}:${nivel}`
          const lotesEnNivel = stockBySlot[slotKey] ?? []
          const isSelectedNivel = selected && selectedNivel === nivel
          return (
            <Group
              key={nivel}
              onClick={(e) => { e.cancelBubble = true; onSelect(id, nivel) }}
              onTap={(e) => { e.cancelBubble = true; onSelect(id, nivel) }}
            >
              {isSelectedNivel && (
                <Rect
                  x={1} y={yTop + 1}
                  width={w - 2} height={nivelHeight - 1}
                  fill="#2563EB"
                  opacity={0.18}
                />
              )}
              {i > 0 && (
                <Line
                  points={[0, yTop, w, yTop]}
                  stroke="#94A3B8"
                  strokeWidth={1}
                  listening={false}
                />
              )}
              <Text
                text={`N${nivel}`}
                x={4} y={yTop + 3}
                fontSize={RACK_NIVEL_FONT}
                fontStyle="bold"
                fill="#78716C"
                listening={false}
              />
              {lotesEnNivel.length > 0 && (
                <Group x={w - 18} y={yTop + 3}>
                  <Rect width={14} height={14} fill="#2563EB" cornerRadius={7} />
                  <Text
                    text={String(lotesEnNivel.length)}
                    width={14} height={14}
                    align="center" verticalAlign="middle"
                    fontSize={8} fontStyle="bold" fill="white"
                    listening={false}
                  />
                </Group>
              )}
            </Group>
          )
        })}

        {/* Codigo label centered for piso, bottom-center for rack */}
        <Text
          text={codigo}
          width={w}
          y={isRack ? h - 14 : h / 2 - 6}
          align="center"
          fontSize={11}
          fontStyle="bold"
          fill="#1E293B"
          listening={false}
        />

        {/* Piso badge */}
        {!isRack && (stockBySlot[`${id}:0`]?.length ?? 0) > 0 && (
          <Group x={w - 20} y={4}>
            <Rect width={16} height={16} fill="#2563EB" cornerRadius={8} />
            <Text
              text={String(stockBySlot[`${id}:0`].length)}
              width={16} height={16}
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
