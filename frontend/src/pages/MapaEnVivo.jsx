import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getMapaEnVivo } from '../api'
import MapaTiendas from '../components/MapaTiendas'

const ESTADO_COLOR = {
  entregada:     '#22C55E',
  rechazada:     '#EF4444',
  local_cerrado: '#F97316',
  parcial:       '#EAB308',
  pendiente:     '#3B82F6',
}
const ESTADO_LABEL = {
  entregada:     'Entregada',
  rechazada:     'Rechazada',
  local_cerrado: 'Cerrado',
  parcial:       'Parcial',
  pendiente:     'Pendiente',
}

// Assign a distinct color per chofer index
const CHOFER_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#14B8A6', '#EF4444',
]

const INTERVALO_SEG = 30

export default function MapaEnVivo() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroChofer, setFiltroChofer] = useState(null)
  const [segundos, setSegundos] = useState(INTERVALO_SEG)
  const timerRef = useRef(null)

  const fetchData = async () => {
    try {
      const r = await getMapaEnVivo()
      setData(r.data)
    } catch {
      toast.error('Error actualizando el mapa')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Countdown + auto-refresh
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSegundos((s) => {
        if (s <= 1) {
          fetchData()
          return INTERVALO_SEG
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  const visible = filtroChofer == null ? data : data.filter((c) => c.chofer_id === filtroChofer)

  // Flatten tiendas with coordinates for the map
  const tiendas = visible.flatMap((chofer, ci) =>
    chofer.paradas
      .filter((p) => p.latitud != null)
      .map((p, pi) => ({
        id: p.tienda_id,
        razon_social: p.tienda,
        latitud: p.latitud,
        longitud: p.longitud,
        _estado: p.estado,
        _choferIdx: data.findIndex((c) => c.chofer_id === chofer.chofer_id),
        _chofer: chofer.chofer,
        _numParada: pi + 1,
        _numeroPedido: p.numero_pedido,
      }))
  )

  const getMarkerColor = (t) =>
    filtroChofer != null
      ? (ESTADO_COLOR[t._estado] ?? '#6B7280')
      : (CHOFER_COLORS[t._choferIdx % CHOFER_COLORS.length] ?? '#6B7280')

  const getMarkerNumber = (t) => t._numParada

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-800">Operación en Vivo</h2>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <button
            onClick={() => { fetchData(); setSegundos(INTERVALO_SEG) }}
            className="text-blue-600 hover:underline"
          >
            Actualizar
          </button>
          <span>Auto en {segundos}s</span>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando operación...</p>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-10 text-center text-gray-400 text-sm">
          No hay rutas activas hoy.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Sidebar */}
          <div className="space-y-3">
            <button
              onClick={() => setFiltroChofer(null)}
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                filtroChofer == null
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              Todos los choferes ({data.length})
            </button>

            {data.map((c, ci) => {
              const pct = c.total > 0 ? Math.round((c.entregadas / c.total) * 100) : 0
              const color = CHOFER_COLORS[ci % CHOFER_COLORS.length]
              const selected = filtroChofer === c.chofer_id
              return (
                <button
                  key={c.chofer_id}
                  onClick={() => setFiltroChofer(selected ? null : c.chofer_id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                    selected
                      ? 'border-blue-500 bg-blue-50'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: color }}
                    />
                    <span className="font-semibold text-gray-800">{c.chofer}</span>
                    {c.salida_en && (
                      <span className="ml-auto text-xs text-gray-400">
                        Salió {new Date(c.salida_en).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {c.entregadas}/{c.total}
                    </span>
                  </div>
                  {c.pendientes > 0 && (
                    <p className="text-xs text-blue-600 mt-1">{c.pendientes} pendiente{c.pendientes !== 1 ? 's' : ''}</p>
                  )}
                </button>
              )
            })}

            {/* Estado legend */}
            {filtroChofer != null && (
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-xs space-y-1">
                <p className="font-medium text-gray-600 mb-2">Estado por color</p>
                {Object.entries(ESTADO_LABEL).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: ESTADO_COLOR[k] }} />
                    <span className="text-gray-600">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Map */}
          <div className="lg:col-span-2">
            <MapaTiendas
              tiendas={tiendas}
              height="520px"
              showLabels
              markerColor={getMarkerColor}
              markerNumber={getMarkerNumber}
            />
          </div>
        </div>
      )}
    </div>
  )
}
