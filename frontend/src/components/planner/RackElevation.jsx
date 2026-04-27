import { memo } from 'react'
import { useDataStore, useCanvasStore } from '../../stores/almacenStore'

// ARCHITECTURAL ELEVATION VIEW — rack drawn from the front, levels stacked
// vertically (top of rack at top of diagram, floor at bottom). This is the
// orthographic complement to the plan view in the canvas.

function RackElevation({ ubicacion }) {
  const stockSlots = useDataStore((s) => s.stock.slots)
  const selectedNivel = useCanvasStore(
    (s) => s.selection?.type === 'ubicacion' && s.selection.id === ubicacion.id
      ? s.selection.nivel : null
  )
  const selectUbicacion = useCanvasStore((s) => s.selectUbicacion)

  // Render top→bottom: nivel N first, nivel 1 last
  const niveles = Array.from({ length: ubicacion.niveles }, (_, i) => ubicacion.niveles - i)
  const totalLotes = niveles.reduce((sum, n) => sum + (stockSlots[`${ubicacion.id}:${n}`]?.length ?? 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vista en alzado</p>
        <span className="text-xs text-gray-400">{totalLotes} lote(s) total</span>
      </div>

      {/* The rack — drawn as stacked compartments with structural side rails */}
      <div className="flex">
        {/* Left vertical rail */}
        <div className="w-1.5 bg-gray-700 rounded-l-sm" />

        <div className="flex-1 border-y-2 border-gray-700">
          {niveles.map((nivel) => {
            const lotes = stockSlots[`${ubicacion.id}:${nivel}`] ?? []
            const isSelected = selectedNivel === nivel
            return (
              <button
                key={nivel}
                onClick={() => selectUbicacion(ubicacion.id, nivel)}
                className={`w-full flex items-center px-3 py-2.5 border-b border-gray-300 last:border-b-0 transition-colors ${
                  isSelected
                    ? 'bg-blue-100'
                    : 'bg-amber-50 hover:bg-amber-100'
                }`}
                style={{ minHeight: '48px' }}
              >
                <span className={`text-sm font-bold w-10 text-left ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                  N{nivel}
                </span>
                <div className="flex-1 mx-2 flex items-center gap-1 flex-wrap">
                  {lotes.length === 0 ? (
                    <span className="text-xs text-gray-400 italic">vacío</span>
                  ) : (
                    lotes.slice(0, 4).map((l) => (
                      <span
                        key={l.id}
                        className="text-xs bg-white border border-amber-300 rounded px-1.5 py-0.5 text-gray-700 max-w-[140px] truncate"
                        title={l.descripcion}
                      >
                        {l.codigo} ×{l.cantidad_bultos}
                      </span>
                    ))
                  )}
                  {lotes.length > 4 && (
                    <span className="text-xs text-gray-500">+{lotes.length - 4}</span>
                  )}
                </div>
                <span className={`text-xs font-medium ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                  {lotes.length}
                </span>
              </button>
            )
          })}
        </div>

        {/* Right vertical rail */}
        <div className="w-1.5 bg-gray-700 rounded-r-sm" />
      </div>

      {/* Floor line */}
      <div className="h-1 bg-gray-700" />
      <div className="h-1.5" style={{
        background: 'repeating-linear-gradient(45deg, #9CA3AF 0 4px, transparent 4px 8px)',
      }} />
    </div>
  )
}

export default memo(RackElevation)
