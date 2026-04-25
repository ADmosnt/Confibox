import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons broken by bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const EMPRESA_COLOR = {
  confibox: '#3B82F6',
  actual:   '#F59E0B',
  ambos:    '#8B5CF6',
}

const EMPRESA_LABEL = {
  confibox: 'Confibox',
  actual:   'Actual',
  ambos:    'Ambos',
}

function makeIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:22px;height:22px;border-radius:50% 50% 50% 0;
      background:${color};border:2px solid white;
      transform:rotate(-45deg);
      box-shadow:0 2px 4px rgba(0,0,0,.4)">
    </div>`,
    iconSize:   [22, 22],
    iconAnchor: [11, 22],
    popupAnchor:[0, -24],
  })
}

function FitBounds({ tiendas }) {
  const map = useMap()
  useEffect(() => {
    const pts = tiendas
      .filter((t) => t.latitud != null && t.longitud != null)
      .map((t) => [t.latitud, t.longitud])
    if (pts.length > 0) {
      map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 })
    }
  }, [tiendas, map])
  return null
}

function CenterButton() {
  const map = useMap()
  const center = (e) => {
    e.stopPropagation()
    navigator.geolocation?.getCurrentPosition(({ coords }) => {
      map.setView([coords.latitude, coords.longitude], 15)
    })
  }
  return (
    <div className="leaflet-bottom leaflet-right" style={{ pointerEvents: 'none' }}>
      <div className="leaflet-control" style={{ pointerEvents: 'auto', marginRight: '12px', marginBottom: '12px' }}>
        <button
          onClick={center}
          title="Mi ubicación"
          className="bg-white rounded-full shadow-md w-10 h-10 flex items-center justify-center text-gray-700 hover:bg-gray-50 text-lg border border-gray-200"
        >
          ◎
        </button>
      </div>
    </div>
  )
}

export default function MapaTiendas({
  tiendas = [],
  height = '400px',
  onTiendaClick,
  selectedId,
}) {
  const center = tiendas.find((t) => t.latitud && t.longitud)
  const defaultCenter = center
    ? [center.latitud, center.longitud]
    : [10.23, -66.85] // fallback: Charallave area

  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-200" style={{ height }}>
      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds tiendas={tiendas} />

        {tiendas
          .filter((t) => t.latitud != null && t.longitud != null)
          .map((t) => (
            <Marker
              key={t.id}
              position={[t.latitud, t.longitud]}
              icon={makeIcon(EMPRESA_COLOR[t.empresa] ?? '#6B7280')}
              eventHandlers={{ click: () => onTiendaClick?.(t) }}
            >
              <Popup>
                <div className="text-sm min-w-[180px]">
                  <p className="font-semibold text-gray-900">{t.razon_social}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{t.direccion}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                      style={{ background: EMPRESA_COLOR[t.empresa] ?? '#6B7280' }}
                    >
                      {EMPRESA_LABEL[t.empresa] ?? t.empresa}
                    </span>
                    {t.zona && (
                      <span className="text-xs text-gray-500">{t.zona}</span>
                    )}
                  </div>
                  {t.telefono && (
                    <a
                      href={`tel:${t.telefono}`}
                      className="block mt-1 text-blue-600 text-xs hover:underline"
                    >
                      {t.telefono}
                    </a>
                  )}
                  <div className="flex gap-2 mt-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${t.latitud},${t.longitud}`}
                      target="_blank"
                      rel="noopener noreferrer"
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
                </div>
              </Popup>
            </Marker>
          ))}

        <CenterButton />
      </MapContainer>
    </div>
  )
}
