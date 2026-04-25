import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getSolicitudes, aprobarSolicitud, rechazarSolicitud } from '../api'

const ESTADO_COLOR = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  aprobada:  'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-700',
}

export default function SolicitudesGeoref() {
  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)
  const [estado, setEstado] = useState('pendiente')

  const load = () => {
    setLoading(true)
    getSolicitudes({ estado: estado || undefined })
      .then((r) => setSolicitudes(r.data))
      .catch(() => toast.error('Error cargando solicitudes'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [estado])

  const handleAprobar = async (id, tienda) => {
    if (!confirm(`¿Aprobar corrección GPS para "${tienda}"? El GPS de la tienda se actualizará.`)) return
    try {
      await aprobarSolicitud(id)
      toast.success('Solicitud aprobada — GPS actualizado')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al aprobar')
    }
  }

  const handleRechazar = async (id) => {
    try {
      await rechazarSolicitud(id)
      toast.success('Solicitud rechazada')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al rechazar')
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-5">Solicitudes de Corrección GPS</h2>

      <div className="flex gap-3 mb-5">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas</option>
          <option value="pendiente">Pendientes</option>
          <option value="aprobada">Aprobadas</option>
          <option value="rechazada">Rechazadas</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-10">Cargando...</p>
        ) : solicitudes.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">
            {estado === 'pendiente' ? 'No hay solicitudes pendientes.' : 'No hay solicitudes.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Tienda</th>
                <th className="px-4 py-3 text-left">Chofer</th>
                <th className="px-4 py-3 text-left">Motivo</th>
                <th className="px-4 py-3 text-left">Coordenadas sugeridas</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {solicitudes.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.tienda}</td>
                  <td className="px-4 py-3 text-gray-500">{s.chofer}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px]">
                    <span title={s.motivo} className="block truncate">{s.motivo ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    <div>{s.latitud_sugerida}, {s.longitud_sugerida}</div>
                    {s.latitud_actual && (
                      <div className="text-gray-400 text-xs mt-0.5">
                        actual: {s.latitud_actual}, {s.longitud_actual}
                      </div>
                    )}
                    <a
                      href={`https://www.google.com/maps?q=${s.latitud_sugerida},${s.longitud_sugerida}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-blue-500 hover:underline text-xs"
                    >
                      Ver en mapa
                    </a>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[s.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                      {s.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {s.creado_en ? new Date(s.creado_en).toLocaleDateString('es-VE') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center space-x-2 whitespace-nowrap">
                    {s.estado === 'pendiente' && (
                      <>
                        <button
                          onClick={() => handleAprobar(s.id, s.tienda)}
                          className="text-xs text-green-600 hover:underline font-medium"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => handleRechazar(s.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
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
