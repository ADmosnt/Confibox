import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getEntregas } from '../api'

const ESTADO_COLOR = {
  pendiente:     'bg-gray-100 text-gray-700',
  entregada:     'bg-green-100 text-green-700',
  rechazada:     'bg-red-100 text-red-700',
  local_cerrado: 'bg-orange-100 text-orange-700',
  parcial:       'bg-yellow-100 text-yellow-700',
}
const ESTADO_LABEL = {
  pendiente: 'Pendiente', entregada: 'Entregada', rechazada: 'Rechazada',
  local_cerrado: 'Local cerrado', parcial: 'Parcial',
}

export default function Entregas() {
  const [entregas, setEntregas] = useState([])
  const [loading, setLoading] = useState(true)
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [estado, setEstado] = useState('')

  const load = () => {
    setLoading(true)
    getEntregas({ fecha: fecha || undefined, estado: estado || undefined })
      .then((r) => setEntregas(r.data))
      .catch(() => toast.error('Error cargando entregas'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [fecha, estado])

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-5">Entregas</h2>

      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {fecha && (
          <button
            onClick={() => setFecha('')}
            className="text-sm text-gray-500 hover:text-gray-700 px-2"
          >
            × Sin filtro fecha
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-10">Cargando...</p>
        ) : entregas.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">No hay entregas para este filtro.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Pedido #</th>
                <th className="px-4 py-3 text-left">Chofer</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Distancia</th>
                <th className="px-4 py-3 text-left">Motivo</th>
                <th className="px-4 py-3 text-left">Observación</th>
                <th className="px-4 py-3 text-left">Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entregas.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{e.pedido_id}</td>
                  <td className="px-4 py-3 text-gray-700">{e.chofer ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[e.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ESTADO_LABEL[e.estado] ?? e.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {e.distancia_metros != null
                      ? <span className={e.distancia_metros > 50 ? 'text-orange-500 font-medium' : ''}>{e.distancia_metros}m</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {e.motivo_incidencia ? e.motivo_incidencia.replace(/_/g, ' ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-[160px]">
                    <span title={e.observacion} className="block truncate">{e.observacion ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {e.hora_registro
                      ? new Date(e.hora_registro).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
