import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  getMiRuta, iniciarJornada, checkinEntrega, createDevolucionEntrega, createSolicitud, uploadFile,
} from '../api'
import MapaTiendas from '../components/MapaTiendas'
import useCurrentPosition from '../hooks/useCurrentPosition'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { Dialog, DialogContent } from '../components/ui/Dialog'
import { ENTREGA_COLOR, ENTREGA_LABEL } from '../components/EstadoBadge'

const ROUTE_CACHE_KEY = 'confibox_ruta_cache'

const ESTADO_COLOR = ENTREGA_COLOR
const ESTADO_LABEL = ENTREGA_LABEL

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

function CheckinModal({ entrega, onClose, onDone, onOffline }) {
  const { position, error: gpsError, loading: gpsLoading, getPosition } = useCurrentPosition()
  const [estadoSel, setEstadoSel] = useState('entregada')
  const [motivo, setMotivo] = useState('')
  const [observacion, setObservacion] = useState('')
  const [alertaDistancia, setAlertaDistancia] = useState(null)
  const [fotoFile, setFotoFile] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { getPosition() }, [])

  const necesitaMotivo = ['rechazada', 'local_cerrado'].includes(estadoSel) || alertaDistancia
  const necesitaFoto   = estadoSel === 'local_cerrado' || alertaDistancia

  useEffect(() => () => { if (fotoPreview) URL.revokeObjectURL(fotoPreview) }, [fotoPreview])

  const handleFotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  const submit = async () => {
    setSubmitting(true)
    const payload = {
      entrega_id: entrega.id,
      estado: estadoSel,
      latitud: position?.lat ?? null,
      longitud: position?.lng ?? null,
      motivo_incidencia: motivo || null,
      observacion: observacion || null,
    }

    // Check offline before calling API to avoid the interceptor's generic toast
    if (!navigator.onLine) {
      onOffline(payload)
      toast('Sin conexión — se sincronizará al reconectarte', { icon: '📴' })
      setSubmitting(false)
      return
    }

    try {
      let foto_evidencia_url = undefined
      if (fotoFile) {
        const r = await uploadFile(fotoFile)
        foto_evidencia_url = r.data.url
      }
      await checkinEntrega(entrega.id, {
        estado: estadoSel,
        latitud: position?.lat ?? null,
        longitud: position?.lng ?? null,
        motivo_incidencia: motivo || undefined,
        observacion: observacion || undefined,
        foto_evidencia_url,
      })
      toast.success('Entrega registrada')
      onDone()
      onClose()
    } catch (err) {
      const data = err.response?.data
      if (data?.requiere_motivo) {
        setAlertaDistancia(data.distancia_metros)
      } else if (!err.response) {
        // Network error mid-request
        onOffline(payload)
        toast('Sin conexión — se sincronizará al reconectarte', { icon: '📴' })
        onClose()
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Foto de evidencia {necesitaFoto ? '*' : '(opcional)'}
            </label>
            {fotoPreview ? (
              <div className="space-y-1.5">
                <img src={fotoPreview} alt="Evidencia" className="w-full max-h-40 object-cover rounded-lg border border-gray-200" />
                <button type="button" onClick={() => { setFotoFile(null); setFotoPreview(null) }} className="text-xs text-red-500 hover:underline">
                  Quitar foto
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <span className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">
                  📷 Tomar foto
                </span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoChange} />
              </label>
            )}
          </div>

          <div className="flex gap-3 pt-2 border-t">
            <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={submitting || (necesitaMotivo && !motivo) || (necesitaFoto && !fotoFile)}
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
                <button onClick={getPosition} className="text-xs text-blue-600 hover:underline">
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
  const [localEstados, setLocalEstados] = useState({})
  const [salidaEn, setSalidaEn] = useState(null)   // departure timestamp from first entrega
  const [salidaLoading, setSalidaLoading] = useState(false)

  const { isOnline, queue, enqueue, syncNow, syncing } = useOfflineSync()
  const pendingIds = new Set(queue.map((q) => q.entrega_id))

  const load = async () => {
    setLoading(true)
    try {
      const r = await getMiRuta()
      setEntregas(r.data)
      setLocalEstados({})
      // Persist the first salida_en we find (all same chofer/day share the timestamp)
      const salida = r.data.find((e) => e.salida_en)?.salida_en ?? null
      setSalidaEn(salida)
      localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(r.data))
    } catch {
      const cached = localStorage.getItem(ROUTE_CACHE_KEY)
      if (cached) {
        try {
          setEntregas(JSON.parse(cached))
          toast('Mostrando ruta guardada', { icon: '📴' })
        } catch {
          toast.error('Error cargando ruta')
        }
      } else {
        toast.error('Error cargando ruta')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Reload silently when connection is restored
    const handleOnline = () => load()
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const handleOfflineCheckin = (payload) => {
    enqueue(payload)
    setLocalEstados((s) => ({ ...s, [payload.entrega_id]: payload.estado }))
    setCheckinId(null)
  }

  const handleIniciarJornada = async () => {
    setSalidaLoading(true)
    try {
      const r = await iniciarJornada()
      setSalidaEn(r.data.salida_en)
      if (r.data.ya_habia_salido) {
        toast('Ya habías confirmado la salida', { icon: '🚛' })
      } else {
        toast.success('Salida confirmada — ¡buen viaje!')
      }
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al confirmar salida')
    } finally {
      setSalidaLoading(false)
    }
  }

  const pendientes  = entregas.filter((e) => ['pendiente', 'parcial'].includes(localEstados[e.id] ?? e.estado)).length
  const completadas = entregas.filter((e) => (localEstados[e.id] ?? e.estado) === 'entregada').length
  const tiendas     = entregas.filter((e) => e.tienda?.latitud != null).map((e) => e.tienda)
  const activeEntrega     = entregas.find((e) => e.id === checkinId)

  // Map helpers — color and stop-number per tienda
  const ESTADO_COLOR_PIN = {
    entregada:     '#22C55E',
    rechazada:     '#EF4444',
    local_cerrado: '#F97316',
    parcial:       '#EAB308',
  }
  const estadoPorTiendaId = Object.fromEntries(
    entregas.filter((e) => e.tienda).map((e) => [e.tienda.id, localEstados[e.id] ?? e.estado])
  )
  const numeroPorTiendaId = Object.fromEntries(
    entregas.filter((e) => e.tienda?.latitud != null).map((e, idx) => [e.tienda.id, idx + 1])
  )
  const getMarkerColor  = (t) => ESTADO_COLOR_PIN[estadoPorTiendaId[t.id]] ?? '#3B82F6'
  const getMarkerNumber = (t) => numeroPorTiendaId[t.id] ?? null
  const devolucionEntrega = entregas.find((e) => e.id === devolucionId)
  const georefEntrega     = entregas.find((e) => e.id === georefId)

  return (
    <div>
      {/* Offline status bar */}
      {!isOnline && (
        <div className="bg-orange-500 text-white text-xs py-2 px-4 text-center rounded-lg mb-4 font-medium">
          📴 Sin conexión — las acciones se guardarán y se enviarán al reconectarte
        </div>
      )}
      {isOnline && queue.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 mb-4 flex items-center justify-between gap-3 text-sm">
          <span className="text-blue-700">
            {queue.length} acción{queue.length !== 1 ? 'es' : ''} pendiente{queue.length !== 1 ? 's' : ''} de sincronizar
          </span>
          <button
            onClick={syncNow}
            disabled={syncing}
            className="text-blue-600 font-medium hover:underline disabled:opacity-50 whitespace-nowrap"
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
        </div>
      )}

      {/* Departure confirmation banner */}
      {!loading && entregas.length > 0 && (
        salidaEn ? (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 mb-4 flex items-center gap-3 text-sm">
            <span className="text-green-700 font-medium">🚛 Salida confirmada</span>
            <span className="text-green-600 text-xs">
              {new Date(salidaEn).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-800">¿Listo para salir?</p>
              <p className="text-xs text-gray-500">Confirma tu salida para registrar la hora de inicio de la jornada.</p>
            </div>
            <button
              onClick={handleIniciarJornada}
              disabled={salidaLoading}
              className="shrink-0 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {salidaLoading ? 'Confirmando...' : '🚛 Salir a repartir'}
            </button>
          </div>
        )
      )}

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
        <MapaTiendas
          tiendas={tiendas}
          height="500px"
          showMyLocation
          showLabels
          routeButton
          markerColor={getMarkerColor}
          markerNumber={getMarkerNumber}
        />
      ) : (
        <div className="space-y-3">
          {entregas.map((e, idx) => {
            const estado = localEstados[e.id] ?? e.estado
            const done = !['pendiente', 'parcial'].includes(estado)
            const isPending = pendingIds.has(e.id)
            const t = e.tienda
            return (
              <div
                key={e.id}
                className={`bg-white rounded-lg shadow p-4 ${done && !isPending ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-gray-400 font-mono">#{idx + 1}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[estado] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ESTADO_LABEL[estado] ?? estado}
                      </span>
                      {isPending && (
                        <span className="text-xs text-orange-500 font-medium">⏳ Pendiente sync</span>
                      )}
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
                    {!done && !isPending && (
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
                    {done && e.hora_registro && (
                      <span className="text-xs text-gray-400">
                        ✓ {new Date(e.hora_registro).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
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
          onOffline={handleOfflineCheckin}
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
