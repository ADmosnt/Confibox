import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { getTiendas, getZonas } from '../api'
import MapaTiendas from '../components/MapaTiendas'

const EMPRESA_CHIP = {
  confibox: 'bg-blue-100 text-blue-700',
  actual:   'bg-orange-100 text-orange-700',
  ambos:    'bg-purple-100 text-purple-700',
}
const EMPRESA_LABEL = { confibox: 'Confibox', actual: 'Actual', ambos: 'Ambos' }

export default function Tiendas() {
  const [tiendas, setTiendas] = useState([])
  const [zonas, setZonas] = useState([])
  const [search, setSearch] = useState('')
  const [zonaId, setZonaId] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [vista, setVista] = useState('lista') // 'lista' | 'mapa'
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    getTiendas({ search, zona_id: zonaId || undefined, empresa: empresa || undefined, activo: true })
      .then((r) => setTiendas(r.data))
      .catch(() => toast.error('Error cargando tiendas'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { getZonas().then((r) => setZonas(r.data)) }, [])
  useEffect(() => { load() }, [search, zonaId, empresa])

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-800">Tiendas</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setVista(v => v === 'lista' ? 'mapa' : 'lista')}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg"
          >
            {vista === 'lista' ? '🗺 Ver mapa' : '☰ Ver lista'}
          </button>
          <Link
            to="/tiendas/nueva"
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg"
          >
            + Nueva tienda
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Buscar tienda..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={zonaId}
          onChange={(e) => setZonaId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las zonas</option>
          {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
        </select>
        <select
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las empresas</option>
          <option value="confibox">Confibox</option>
          <option value="actual">Actual</option>
          <option value="ambos">Ambos</option>
        </select>
      </div>

      {vista === 'mapa' ? (
        <MapaTiendas tiendas={tiendas} height="500px" />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          {loading ? (
            <p className="text-center text-gray-400 text-sm py-10">Cargando...</p>
          ) : tiendas.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">No hay tiendas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Código</th>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-left">Zona</th>
                  <th className="px-4 py-3 text-left">Empresa</th>
                  <th className="px-4 py-3 text-left">Teléfono</th>
                  <th className="px-4 py-3 text-left">GPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tiendas.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.codigo}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/tiendas/${t.id}`} className="text-blue-600 hover:underline">
                        {t.razon_social}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{t.zona ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EMPRESA_CHIP[t.empresa] ?? 'bg-gray-100 text-gray-600'}`}>
                        {EMPRESA_LABEL[t.empresa] ?? t.empresa}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.telefono
                        ? <a href={`tel:${t.telefono}`} className="text-blue-600 hover:underline">{t.telefono}</a>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {t.latitud
                        ? <span className="text-green-600 text-xs">✓ Registrado</span>
                        : <span className="text-red-400 text-xs">Sin GPS</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
