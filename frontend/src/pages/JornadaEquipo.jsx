import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getJornadaEquipo, createJornadaEquipo, deleteJornadaEquipo, getUsuariosByRol } from '../api'

export default function JornadaEquipo() {
  const hoy = new Date().toISOString().slice(0, 10)
  const [fecha, setFecha] = useState(hoy)
  const [asignaciones, setAsignaciones] = useState([])
  const [choferes, setChoferes] = useState([])
  const [ayudantes, setAyudantes] = useState([])
  const [choferSel, setChoferSel] = useState('')
  const [ayudanteSel, setAyudanteSel] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    getJornadaEquipo(fecha).then((r) => setAsignaciones(r.data)).catch(() => toast.error('Error cargando asignaciones'))
  }

  useEffect(() => {
    getUsuariosByRol('chofer').then((r) => setChoferes(r.data)).catch(() => {})
    getUsuariosByRol('ayudante').then((r) => setAyudantes(r.data)).catch(() => {})
  }, [])

  useEffect(() => { load() }, [fecha])

  const asignadosIds = new Set(asignaciones.map((a) => a.ayudante_id))
  const disponibles = ayudantes.filter((u) => u.activo && !asignadosIds.has(u.id))

  const handleCreate = async () => {
    if (!choferSel || !ayudanteSel) return toast.error('Selecciona chofer y ayudante')
    setSaving(true)
    try {
      await createJornadaEquipo({ chofer_id: Number(choferSel), ayudante_id: Number(ayudanteSel), fecha })
      toast.success('Asignación creada')
      setChoferSel(''); setAyudanteSel('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al crear asignación')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteJornadaEquipo(id)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al eliminar')
    }
  }

  const sel = 'border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-5">Jornada — Equipo de Reparto</h2>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <label className="text-sm text-gray-600">Fecha:</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className={sel}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Asignaciones del día */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Asignaciones del {fecha}</h3>
          {asignaciones.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Sin asignaciones para este día</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {asignaciones.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2.5">
                  <div className="text-sm">
                    <span className="font-medium text-gray-800">{a.ayudante}</span>
                    <span className="text-gray-400 mx-2">→</span>
                    <span className="text-gray-600">{a.chofer}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-xs text-red-500 hover:underline flex-shrink-0"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nueva asignación */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Nueva asignación</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ayudante</label>
              <select value={ayudanteSel} onChange={(e) => setAyudanteSel(e.target.value)} className={`w-full ${sel}`}>
                <option value="">Seleccionar ayudante...</option>
                {disponibles.map((u) => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
              {disponibles.length === 0 && ayudantes.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">Todos los ayudantes ya están asignados hoy</p>
              )}
              {ayudantes.length === 0 && (
                <p className="text-xs text-orange-500 mt-1">No hay usuarios con rol ayudante registrados</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Chofer</label>
              <select value={choferSel} onChange={(e) => setChoferSel(e.target.value)} className={`w-full ${sel}`}>
                <option value="">Seleccionar chofer...</option>
                {choferes.filter((u) => u.activo).map((u) => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCreate}
              disabled={saving || !choferSel || !ayudanteSel}
              className="w-full bg-blue-600 text-white text-sm py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Asignar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
