import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { toast } from 'sonner'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const EMPRESA_COLOR = { confibox: '#3B82F6', actual: '#F59E0B', ambos: '#8B5CF6' }
const EMPRESA_LABEL = { confibox: 'Confibox', actual: 'Actual', ambos: 'Ambos' }

function makeIcon(color, number) {
  const label = number != null
    ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(45deg)"><span style="color:white;font-size:9px;font-weight:700;line-height:1">${number}</span></div>`
    : ''
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:26px;height:26px;border-radius:50% 50% 50% 0;background:${color};border:2.5px solid white;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.35)">${label}</div>`,
    iconSize:     [26, 26],
    iconAnchor:   [13, 26],
    popupAnchor:  [0, -28],
    tooltipAnchor:[0, -28],
  })
}

// ── Real-time GPS dot ──────────────────────────────────────────────────────────

function LocationDot({ locationRef }) {
  const map = useMap()
  const dotRef  = useRef(null)
  const ringRef = useRef(null)

  useEffect(() => {
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const pos = [coords.latitude, coords.longitude]
        if (locationRef) locationRef.current = pos

        if (!dotRef.current) {
          dotRef.current = L.circleMarker(pos, {
            radius: 8,
            fillColor: '#2563EB',
            color: '#fff',
            weight: 2.5,
            fillOpacity: 1,
            zIndexOffset: 1000,
          }).addTo(map).bindTooltip('Tu ubicación', { direction: 'top' })

          if (coords.accuracy < 500) {
            ringRef.current = L.circle(pos, {
              radius: coords.accuracy,
              color: '#2563EB',
              fillColor: '#2563EB',
              fillOpacity: 0.1,
              weight: 1,
              interactive: false,
            }).addTo(map)
          }
        } else {
          dotRef.current.setLatLng(pos)
          if (ringRef.current) {
            ringRef.current.setLatLng(pos)
            ringRef.current.setRadius(coords.accuracy)
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
      dotRef.current?.remove();  dotRef.current  = null
      ringRef.current?.remove(); ringRef.current = null
    }
  }, [map, locationRef])

  return null
}

// ── Center-on-me button ────────────────────────────────────────────────────────

function CenterButton({ locationRef }) {
  const map = useMap()

  const center = () => {
    if (locationRef?.current) {
      map.setView(locationRef.current, 16)
      return
    }
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => map.setView([coords.latitude, coords.longitude], 16),
      () => toast.error('No se pudo obtener tu ubicación. Verifica que el GPS esté activo y que la página tenga permiso.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className="leaflet-bottom leaflet-right" style={{ pointerEvents: 'none' }}>
      <div className="leaflet-control" style={{ pointerEvents: 'auto', marginRight: '12px', marginBottom: '12px' }}>
        <button
          onClick={center}
          title="Centrar en mi ubicación"
          className="bg-white rounded-full shadow-md w-10 h-10 flex items-center justify-center text-blue-600 hover:bg-blue-50 text-lg border border-gray-200"
        >
          ◎
        </button>
      </div>
    </div>
  )
}

// ── Open full route in Google Maps ─────────────────────────────────────────────

function RouteButton({ tiendas }) {
  const pts = tiendas.filter((t) => t.latitud != null && t.longitud != null)
  if (pts.length < 2) return null

  const open = () => {
    const MAX = 10
    const stops = pts.slice(0, MAX)
    const url = `https://www.google.com/maps/dir/${stops.map((t) => `${t.latitud},${t.longitud}`).join('/')}`
    window.open(url, '_blank', 'noopener,noreferrer')
    if (pts.length > MAX) {
      toast(`Se abrieron ${MAX} de ${pts.length} paradas (límite de Google Maps)`, { icon: 'ℹ️' })
    }
  }

  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'none' }}>
      <div className="leaflet-control" style={{ pointerEvents: 'auto', margin: '10px 10px 0 0' }}>
        <button
          onClick={open}
          className="bg-white text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg shadow-md border border-gray-200 hover:bg-gray-50 whitespace-nowrap"
        >
          🗺 Ruta completa en Maps
        </button>
      </div>
    </div>
  )
}

// ── FitBounds ─────────────────────────────────────────────────────────────────

function FitBounds({ tiendas }) {
  const map = useMap()
  useEffect(() => {
    const pts = tiendas
      .filter((t) => t.latitud != null && t.longitud != null)
      .map((t) => [t.latitud, t.longitud])
    if (pts.length > 0) map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 })
  }, [tiendas, map])
  return null
}

// ── Main component ─────────────────────────────────────────────────────────────

/**
 * Props:
 *  tiendas      – array of tienda objects with latitud/longitud
 *  height       – CSS height string (default '400px')
 *  onTiendaClick – called with tienda when a marker is clicked
 *  selectedId   – highlights this tienda id (reserved for future use)
 *  showMyLocation – show real-time GPS blue dot (watchPosition)
 *  markerColor  – (tienda) => colorString; overrides empresa color
 *  markerNumber – (tienda) => number | null; shows stop number on pin
 *  showLabels   – show permanent name labels above each pin
 *  routeButton  – show "Ruta completa en Maps" button
 */
export default function MapaTiendas({
  tiendas = [],
  height = '400px',
  onTiendaClick,
  selectedId,
  showMyLocation = false,
  markerColor,
  markerNumber,
  showLabels = false,
  routeButton = false,
}) {
  const locationRef  = useRef(null)
  const first        = tiendas.find((t) => t.latitud && t.longitud)
  const defaultCenter = first ? [first.latitud, first.longitud] : [10.23, -66.85]

  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-200" style={{ height }}>
      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds tiendas={tiendas} />
        {showMyLocation && <LocationDot locationRef={locationRef} />}
        {routeButton    && <RouteButton tiendas={tiendas} />}

        {tiendas
          .filter((t) => t.latitud != null && t.longitud != null)
          .map((t) => {
            const color  = markerColor  ? markerColor(t)  : (EMPRESA_COLOR[t.empresa] ?? '#6B7280')
            const number = markerNumber ? markerNumber(t) : null
            return (
              <Marker
                key={t.id}
                position={[t.latitud, t.longitud]}
                icon={makeIcon(color, number)}
                eventHandlers={{ click: () => onTiendaClick?.(t) }}
              >
                {showLabels && (
                  <Tooltip
                    permanent
                    direction="top"
                    offset={[0, -28]}
                    className="!bg-white !text-xs !font-semibold !shadow !border-0 !rounded-md !px-2 !py-0.5 !text-gray-800"
                  >
                    {t.razon_social}
                  </Tooltip>
                )}

                <Popup>
                  <div className="text-sm min-w-[190px]">
                    <p className="font-semibold text-gray-900">{t.razon_social}</p>
                    {t.direccion && <p className="text-gray-500 text-xs mt-0.5">{t.direccion}</p>}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {t.empresa && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                          style={{ background: EMPRESA_COLOR[t.empresa] ?? '#6B7280' }}
                        >
                          {EMPRESA_LABEL[t.empresa] ?? t.empresa}
                        </span>
                      )}
                      {t.zona && <span className="text-xs text-gray-500">{t.zona}</span>}
                    </div>
                    {t.telefono && (
                      <a href={`tel:${t.telefono}`} className="block mt-1 text-blue-600 text-xs hover:underline">
                        {t.telefono}
                      </a>
                    )}
                    <div className="flex gap-2 mt-2">
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
                  </div>
                </Popup>
              </Marker>
            )
          })}

        <CenterButton locationRef={locationRef} />
      </MapContainer>
    </div>
  )
}
