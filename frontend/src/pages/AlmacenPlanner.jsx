import { useState } from 'react'
import { toast } from 'sonner'
import PlannerCanvas from '../components/planner/PlannerCanvas'
import PlannerSidebar from '../components/planner/PlannerSidebar'
import { useAlmacenData } from '../hooks/useAlmacenData'

export default function AlmacenPlanner() {
  const data = useAlmacenData()
  const [editMode, setEditMode] = useState(false)
  // selection: null | { type: 'zona', id } | { type: 'ubicacion', id, nivel }
  const [selection, setSelection] = useState(null)

  const handleDropFromSidebar = async (id, { x, y }) => {
    await data.patchUbicacion(id, { x, y })
    setSelection({ type: 'ubicacion', id })
    toast.success('Ubicación posicionada')
  }

  const handleRemoveZona = async (id) => {
    if (!window.confirm('¿Eliminar esta zona? Las ubicaciones que la usaban quedarán sin zona.')) return
    await data.removeZona(id)
    if (selection?.type === 'zona' && selection.id === id) setSelection(null)
  }

  const handleRemoveUbicacion = async (id) => {
    if (!window.confirm('¿Eliminar esta ubicación?')) return
    await data.removeUbicacion(id)
    if (selection?.type === 'ubicacion' && selection.id === id) setSelection(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Planner de Almacén</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {data.ubicaciones.length} ubicaciones · {data.zonas.length} zonas · {data.stock.sin_ubicar?.length ?? 0} lotes sin ubicar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditMode((v) => !v); setSelection(null) }}
            className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              editMode
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {editMode ? '✏️ Modo Diseño' : '👁 Modo Inventario'}
          </button>
          <button onClick={data.loadAll} className="text-sm text-blue-600 hover:underline">
            Actualizar
          </button>
        </div>
      </div>

      {data.loading ? (
        <p className="text-gray-400 text-sm">Cargando plano...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="min-w-0">
            <PlannerCanvas
              zonas={data.zonas}
              ubicaciones={data.ubicaciones}
              stockBySlot={data.stock.slots}
              selection={selection}
              onSelect={setSelection}
              onMoveZona={data.patchZona}
              onMoveUbicacion={data.patchUbicacion}
              editMode={editMode}
              onDropFromSidebar={handleDropFromSidebar}
            />
            <p className="text-xs text-gray-400 mt-1.5">
              {editMode
                ? 'Modo Diseño · arrastra para mover, esquinas para redimensionar, click derecho ×  para eliminar'
                : 'Modo Inventario · click en zona, ubicación o nivel para ver detalle'}
            </p>
          </div>

          <PlannerSidebar
            data={data}
            selection={selection}
            editMode={editMode}
            onSelectFromList={setSelection}
            onRemoveZona={handleRemoveZona}
            onRemoveUbicacion={handleRemoveUbicacion}
          />
        </div>
      )}
    </div>
  )
}
