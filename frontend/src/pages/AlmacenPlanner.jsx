// Confibox/frontend/src/pages/AlmacenPlanner.jsx
import { useEffect } from 'react'
import PlannerCanvas from '../components/planner/PlannerCanvas'
import PlannerSidebar from '../components/planner/PlannerSidebar'
import { useDataStore, useCanvasStore, useShallow } from '../stores/almacenStore'

const GRID_OPTIONS = [10, 25, 50]
const VIEW_MODES = [
  { key: 'normal',  label: '🎨 Normal',  hint: 'Colores por tipo' },
  { key: 'heatmap', label: '🌡️ Ocupación', hint: 'Verde→Rojo según % de capacidad' },
  { key: 'fefo',    label: '⏰ FEFO',    hint: 'Rojo = vence pronto' },
]

export default function AlmacenPlanner() {
  const loadAll = useDataStore((s) => s.loadAll)
  const loading = useDataStore((s) => s.loading)
  const editMode = useCanvasStore((s) => s.editMode)
  const toggleEditMode = useCanvasStore((s) => s.toggleEditMode)
  const gridSize = useCanvasStore((s) => s.gridSize)
  const setGridSize = useCanvasStore((s) => s.setGridSize)
  const viewMode = useCanvasStore((s) => s.viewMode)
  const setViewMode = useCanvasStore((s) => s.setViewMode)
  const counts = useDataStore(useShallow((s) => ({
    ubicaciones: s.ubicaciones.length,
    zonas: s.zonas.length,
    sinUbicar: s.stock.sin_ubicar?.length ?? 0,
  })))

  useEffect(() => { loadAll() }, [loadAll])

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Planner de Almacén</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {counts.ubicaciones} ubicaciones · {counts.zonas} zonas · {counts.sinUbicar} lotes sin ubicar
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode picker */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {VIEW_MODES.map((vm) => (
              <button
                key={vm.key}
                onClick={() => setViewMode(vm.key)}
                title={vm.hint}
                className={`text-xs px-2.5 py-1 rounded transition-colors ${
                  viewMode === vm.key
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {vm.label}
              </button>
            ))}
          </div>
          {editMode && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <span>Grid:</span>
              {GRID_OPTIONS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGridSize(g)}
                  className={`px-2 py-1 rounded border transition-colors ${
                    gridSize === g
                      ? 'bg-gray-700 text-white border-gray-700'
                      : 'bg-white border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {g}px
                </button>
              ))}
            </div>
          )}
          <button
            onClick={toggleEditMode}
            className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              editMode
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {editMode ? '✏️ Modo Diseño' : '👁 Modo Inventario'}
          </button>
          <button onClick={loadAll} className="text-sm text-blue-600 hover:underline">
            Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando plano...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
          <div className="min-w-0">
            <PlannerCanvas />
            <p className="text-xs text-gray-400 mt-1.5">
              {editMode
                ? 'Modo Diseño · arrastra para mover · rueda para zoom · R para rotar 90° · borde rojo = colisión'
                : 'Modo Inventario · rueda para zoom · arrastra el fondo para navegar · click en ubicación para ver stock'}
            </p>
          </div>
          <PlannerSidebar />
        </div>
      )}
    </div>
  )
}
