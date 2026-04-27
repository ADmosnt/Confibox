import { useEffect } from 'react'
import PlannerCanvas from '../components/planner/PlannerCanvas'
import PlannerSidebar from '../components/planner/PlannerSidebar'
import { useDataStore, useCanvasStore, useShallow } from '../stores/almacenStore'

// Orchestrator: just composes layout. All state/data flows through Zustand
// stores, components subscribe atomically — no prop drilling.

export default function AlmacenPlanner() {
  const loadAll = useDataStore((s) => s.loadAll)
  const loading = useDataStore((s) => s.loading)
  const editMode = useCanvasStore((s) => s.editMode)
  const toggleEditMode = useCanvasStore((s) => s.toggleEditMode)
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
        <div className="flex items-center gap-2">
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
                ? 'Vista en planta · arrastra zonas y ubicaciones para moverlas'
                : 'Vista en planta · click en una ubicación para ver su alzado y stock'}
            </p>
          </div>
          <PlannerSidebar />
        </div>
      )}
    </div>
  )
}
