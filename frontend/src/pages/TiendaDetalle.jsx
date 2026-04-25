import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { getTienda } from '../api'
import MapaTiendas from '../components/MapaTiendas'
import { useAuth } from '../context/AuthContext'

const EMPRESA_CHIP = {
  confibox: 'bg-blue-100 text-blue-700',
  actual:   'bg-orange-100 text-orange-700',
  ambos:    'bg-purple-100 text-purple-700',
}
const EMPRESA_LABEL = { confibox: 'Confibox', actual: 'Actual', ambos: 'Ambos' }

export default function TiendaDetalle() {
  const { id } = useParams()
  const { user } = useAuth()
  const [tienda, setTienda] = useState(null)
  const [loading, setLoading] = useState(true)
  const canEdit = ['admin', 'vendedor'].includes(user?.rol)

  useEffect(() => {
    getTienda(id)
      .then((r) => setTienda(r.data))
      .catch(() => toast.error('Error cargando tienda'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="text-gray-400 text-sm">Cargando...</p>
  if (!tienda) return <p className="text-gray-400 text-sm">Tienda no encontrada.</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Link to="/tiendas" className="text-blue-600 text-sm hover:underline">← Tiendas</Link>
          <span className="text-gray-400">/</span>
          <h2 className="text-xl font-bold text-gray-800">{tienda.razon_social}</h2>
        </div>
        {canEdit && (
          <Link
            to={`/tiendas/${id}/editar`}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg"
          >
            Editar
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Información general</h3>
          <dl className="space-y-3 text-sm">
            <Row label="Código">
              <span className="font-mono text-xs">{tienda.codigo ?? '—'}</span>
            </Row>
            <Row label="Razón social">{tienda.razon_social}</Row>
            <Row label="RIF">{tienda.rif ?? '—'}</Row>
            <Row label="Zona">{tienda.zona ?? '—'}</Row>
            <Row label="Empresa">
              {tienda.empresa ? (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EMPRESA_CHIP[tienda.empresa] ?? 'bg-gray-100 text-gray-600'}`}>
                  {EMPRESA_LABEL[tienda.empresa] ?? tienda.empresa}
                </span>
              ) : '—'}
            </Row>
            <Row label="Teléfono">
              {tienda.telefono
                ? <a href={`tel:${tienda.telefono}`} className="text-blue-600 hover:underline">{tienda.telefono}</a>
                : '—'}
            </Row>
            <Row label="Dirección">{tienda.direccion ?? '—'}</Row>
            {tienda.observaciones && <Row label="Observaciones">{tienda.observaciones}</Row>}
            <Row label="GPS">
              {tienda.latitud
                ? <span className="text-green-600 text-xs">✓ {tienda.latitud}, {tienda.longitud}</span>
                : <span className="text-red-400 text-xs">Sin coordenadas</span>}
            </Row>
            {tienda.latitud && (
              <div className="pt-2 flex gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${tienda.latitud},${tienda.longitud}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                >
                  Abrir en Maps
                </a>
                <a
                  href={`waze://ul?ll=${tienda.latitud},${tienda.longitud}&navigate=yes`}
                  className="text-xs bg-sky-500 text-white px-3 py-1.5 rounded hover:bg-sky-600"
                >
                  Abrir en Waze
                </a>
              </div>
            )}
          </dl>
        </div>

        <div className="space-y-4">
          {tienda.foto_url && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <img
                src={tienda.foto_url}
                alt="Fachada"
                className="w-full object-cover max-h-56"
              />
              <p className="text-xs text-gray-400 px-3 py-1.5">Fachada</p>
            </div>
          )}
          {tienda.latitud ? (
            <MapaTiendas tiendas={[tienda]} height="320px" />
          ) : (
            <div className="bg-white rounded-lg shadow flex items-center justify-center text-gray-400 text-sm min-h-[200px]">
              Sin GPS registrado para esta tienda.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500 shrink-0">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}
