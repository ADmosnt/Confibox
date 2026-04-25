import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getMiRuta, checkinEntrega, createDevolucionEntrega, createSolicitud } from '../api'
import MapaTiendas from '../components/MapaTiendas'
import useCurrentPosition from '../hooks/useCurrentPosition'
import { Dialog, DialogContent } from '../components/ui/Dialog'

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

const OPCIONES_ESTADO = [
  { value: 'entregada',     label: 'Entregada' },
  { value: 'local_cerrado', label: 'Local cerrado' },
  { value: 'rechazada',     label: 'Rechazada' },
  { value: 'parcial',       label: 'Parcial' },
]

const MOTIVOS_INCIDENCIA = [
  { value: 'local_cerrado',       label: 'Local cerrado' },
  { value: 'no_recibio',          label: 'No recibió' },
  { value: 'sin_pago',            label: 'Sin pago' },
  { value: 'no_estaba_encargado', label: 'No estaba el encargado' },
  { value: 'otro',                label: 'Otro' },
]

const MOTIVOS_DEVOLUCION = [
  { value: 'error_pedido',       label: 'Error en pedido' },
  { value: 'mercancia_danada',   label: 'Mercancía dañada' },
  { value: 'cliente_no_recibio', label: 'Cliente no recibió' },
  { value: 'otro',               label: 'Otro' },
]

// ── CheckinModal ───────────────────────────────────────────────────────────────

function CheckinModal({ entrega, onClose, onDone }) {
  const { position, error: gpsError, loading: gpsLoading, getPosition } = useCurrentPosition()
  const [estadoSel, setEstadoSel] = useState('entregada')
  const [motivo, setMotivo] = useState('')
  const [observacion, setObservacion] = useState('')
  const [alertaDistancia, setAlertaDistancia] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { getPosition() }, [])

  const necesitaMotivo = ['rechazada', 'local_cerrado'].includes(estadoSel) || alertaDistancia

  const submit = async () => {
    setSubmitting(true)
    try {
      await checkinEntrega(entrega.id, {
        estado: estadoSel,
        latitud: position?.lat ?? null,
        longitud: position?.lng ?? null,
        motivo_incidencia: motivo || undefined,
        observacion: observacion || undefined,
      })
      toast.success('Entrega registrada')
      onDone()
      onClose()
    } catch (err) {
      const data = err.response?.data
      if (data?.requiere_motivo) {
        setAlertaDistancia(data.distancia_metros)
      } else {
        toast.error(data?.error ?? 'Error al registrar entrega')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const tienda = entrega.tienda

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Registrar entrega" size="md">
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-gray-800">{tienda?.razon_social}</p>
            {tienda?.direccion && <p className="text-xs text-gray-500 mt-0.5">{tienda.direccion}</p>}
            <p className="text-xs text-gray-400 font-mono mt-1">{entrega.pedido?.numero_pedido}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Estado de la entrega</p>
            <div className="grid grid-cols-2 gap-2">
              {OPCIONES_ESTADO.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setEstadoSel(opt.value); setAlertaDistancia(null); setMotivo('') }}
                  className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                    estadoSel === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-gray-500">
            {gpsLoading
              ? '📍 Obteniendo ubicación...'
              : position
                ? `📍 ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`
                : gpsError
                  ? `⚠ GPS: ${gpsError}`
                  : '—'}
          </div>

          {alertaDistancia && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
              Estás a <strong>{alertaDistancia}m</strong> de la tienda (máx. 50m).
              Selecciona un motivo para registrar de igual modo.
            </div>
          )}

          {necesitaMotivo && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo {['rechazada', 'local_cerrado'].includes(estadoSel) ? '*' : '(requerido por distancia)'}
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar...</option>
                {MOTIVOS_INCIDENCIA.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observación (opcional)</label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={2}
              placeholder="Ej: dejé el pedido con la cajera"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2 border-t">
            <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={submitting || (necesitaMotivo && !motivo)}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── DevolucionModal ────────────────────────────────────────────────────────────

function DevolucionModal({ entrega, onClose, onDone }) {
  const detalles = entrega.pedido?.detalles ?? []
  const [productoId, setProductoId] = useState(detalles[0]?.producto_id ?? '')
  const [cantBultos, setCantBultos] = useState(0)
  const [cantUnidades, setCantUnidades] = useState(0)
  const [motivo, setMotivo] = useState('')
  const [reingresa, setReingresa] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!productoId) return toast.error('Selecciona un producto')
    if (!cantBultos && !cantUnidades) return toast.error('Ingresa al menos una cantidad')
    setSubmitting(true)
    try {
      await createDevolucionEntrega(entrega.id, {
        producto_id: Number(productoId),
        cantidad_bultos: Number(cantBultos) || 0,
        cantidad_unidades: Number(cantUnidades) || 0,
        motivo: motivo || undefined,
        reingresa_almacen: reingresa,
      })
      toast.success('Devolución registrada')
      onDone()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al registrar devolución')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Registrar devolución" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Pedido <span className="font-mono font-medium">{entrega.pedido?.numero_pedido}</span> ·{' '}
            {entrega.tienda?.razon_social}
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Producto *</label>
            <select
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar...</option>
              {detalles.map((d) => (
                <option key={d.producto_id ?? d.id} value={d.producto_id ?? d.id}>
                  {d.descripcion} ({d.codigo})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bultos</label>
              <input
                type="number" min={0}
                value={cantBultos}
                onChange={(e) => setCantBultos(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Uds. sueltas</label>
              <input
                type="number" min={0}
                value={cantUnidades}
                onChange={(e) => setCantUnidades(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin especificar</option>
              {MOTIVOS_DEVOLUCION.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={reingresa}
              onChange={(e) => setReingresa(e.target.checked)}
              className="rounded"
            />
            Reingresar mercancía al almacén
          </label>

          <div className="flex gap-3 pt-2 border-t">
            <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex-1 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Registrar devolución'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── GeorefModal ────────────────────────────────────────────────────────────────

function GeorefModal({ entrega, onClose }) {
  const { position, error: gpsError, loading: gpsLoading, getPosition } = useCurrentPosition()
  const [motivo, setMotivo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { getPosition() }, [])

  const tienda = entrega.tienda

  const submit = async () => {
    if (!position) return toast.error('No se pudo obtener tu ubicación GPS')
    setSubmitting(true)
    try {
      await createSolicitud({
        tienda_id: tienda.id,
        latitud_sugerida: position.lat,
        longitud_sugerida: position.lng,
        latitud_actual: tienda.latitud ?? undefined,
        longitud_actual: tienda.longitud ?? undefined,
        motivo: motivo || undefined,
      })
      toast.success('Corrección GPS enviada al administrador')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al enviar solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Proponer corrección GPS" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Tienda: <span className="font-semibold">{tienda?.razon_social}</span>
          </p>

          {tienda?.latitud ? (
            <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
              Coordenadas actuales: {tienda.latitud}, {tienda.longitud}
            </div>
          ) : (
            <div className="text-xs text-orange-600 bg-orange-50 rounded p-2">
              Esta tienda aún no tiene coordenadas registradas.
            </div>
          )}

          <div className="text-sm">
            {gpsLoading ? (
              <span className="text-gray-500">📍 Obteniendo tu ubicación...</span>
            ) : position ? (
              <span className="text-green-700 font-medium">
                📍 Tu ubicación: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
              </span>
            ) : (
              <div>
                <p className="text-red-500 text-xs mb-2">{gpsError ?? 'No se pudo obtener ubicación'}</p>
                <button
                  onClick={getPosition}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Reintentar
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / observación (opcional)</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Ej: el pin está en la calle equivocada"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2 border-t">
            <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={submitting || !position}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Enviando...' : 'Enviar corrección'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── MiRuta page ────────────────────────────────────────────────────────────────

export default function MiRuta() {
  const [entregas, setEntregas] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('lista')
  const [checkinId, setCheckinId] = useState(null)
  const [devolucionId, setDevolucionId] = useState(null)
  const [georefId, setGeorefId] = useState(null)

  const load = () => {
    setLoading(true)
    getMiRuta()
      .then((r) => setEntregas(r.data))
      .catch(() => toast.error('Error cargando ruta'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const pendientes  = entregas.filter((e) => ['pendiente', 'parcial'].includes(e.estado)).length
  const completadas = entregas.filter((e) => e.estado === 'entregada').length
  const tiendas     = entregas.filter((e) => e.tienda?.latitud != null).map((e) => e.tienda)
  const activeEntrega   = entregas.find((e) => e.id === checkinId)
  const devolucionEntrega = entregas.find((e) => e.id === devolucionId)
  const georefEntrega   = entregas.find((e) => e.id === georefId)

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Mi Ruta</h2>
          {!loading && entregas.length > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {completadas} de {entregas.length} entregadas
              {pendientes > 0 && ` · ${pendientes} pendiente${pendientes !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>
        {entregas.length > 0 && (
          <button
            onClick={() => setVista((v) => v === 'lista' ? 'mapa' : 'lista')}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg"
          >
            {vista === 'lista' ? '🗺 Ver mapa' : '☰ Ver lista'}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando ruta...</p>
      ) : entregas.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-10 text-center text-gray-400 text-sm">
          No tienes entregas asignadas en este momento.
        </div>
      ) : vista === 'mapa' ? (
        <MapaTiendas tiendas={tiendas} height="500px" />
      ) : (
        <div className="space-y-3">
          {entregas.map((e, idx) => {
            const t = e.tienda
            const done = !['pendiente', 'parcial'].includes(e.estado)
            return (
              <div
                key={e.id}
                className={`bg-white rounded-lg shadow p-4 ${done ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400 font-mono">#{idx + 1}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[e.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ESTADO_LABEL[e.estado] ?? e.estado}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-800 truncate">{t?.razon_social ?? '—'}</p>
                    {t?.direccion && <p className="text-xs text-gray-500 mt-0.5">{t.direccion}</p>}
                    {t?.zona && <p className="text-xs text-gray-400">{t.zona}</p>}
                    <p className="text-xs text-gray-400 font-mono mt-1">{e.pedido?.numero_pedido}</p>
                  </div>

                  <div className="flex flex-col gap-2 items-end shrink-0">
                    {t?.telefono && (
                      <a href={`tel:${t.telefono}`} className="text-xs text-blue-600 hover:underline">
                        {t.telefono}
                      </a>
                    )}
                    {t?.latitud && (
                      <div className="flex gap-1">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${t.latitud},${t.longitud}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                        >
                          Maps
                        </a>
                        <a
                          href={`waze://ul?ll=${t.latitud},${t.longitud}&navigate=yes`}
                          className="text-xs bg-sky-500 text-white px-2 py-1 rounded hover:bg-sky-600"
                        >
                          Waze
                        </a>
                      </div>
                    )}
                    {!done && (
                      <button
                        onClick={() => setCheckinId(e.id)}
                        className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium"
                      >
                        Registrar
                      </button>
                    )}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setDevolucionId(e.id)}
                        className="text-xs text-orange-600 hover:underline"
                      >
                        Devolución
                      </button>
                      {t && (
                        <button
                          onClick={() => setGeorefId(e.id)}
                          className="text-xs text-gray-500 hover:underline"
                        >
                          Corregir GPS
                        </button>
                      )}
                    </div>
                    {e.distancia_metros != null && (
                      <span className={`text-xs ${e.distancia_metros > 50 ? 'text-orange-500' : 'text-gray-400'}`}>
                        {e.distancia_metros}m del punto
                      </span>
                    )}
                  </div>
                </div>

                {(e.motivo_incidencia || e.observacion) && (
                  <p className="mt-2 text-xs text-orange-600 border-t border-gray-100 pt-2">
                    {e.motivo_incidencia && <span>{e.motivo_incidencia.replace(/_/g, ' ')}</span>}
                    {e.motivo_incidencia && e.observacion && ' · '}
                    {e.observacion && <span>{e.observacion}</span>}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {activeEntrega && (
        <CheckinModal
          entrega={activeEntrega}
          onClose={() => setCheckinId(null)}
          onDone={load}
        />
      )}
      {devolucionEntrega && (
        <DevolucionModal
          entrega={devolucionEntrega}
          onClose={() => setDevolucionId(null)}
          onDone={load}
        />
      )}
      {georefEntrega && (
        <GeorefModal
          entrega={georefEntrega}
          onClose={() => setGeorefId(null)}
        />
      )}
    </div>
  )
}
