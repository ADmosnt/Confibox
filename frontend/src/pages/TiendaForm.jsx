import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { getTienda, createTienda, updateTienda, getZonas, getUsuariosByRol, uploadFile } from '../api'
import useCurrentPosition from '../hooks/useCurrentPosition'
import MapaTiendas from '../components/MapaTiendas'
import { useAuth } from '../context/AuthContext'

const EMPRESAS = [
  { value: 'confibox', label: 'Confibox' },
  { value: 'actual',   label: 'Actual' },
  { value: 'ambos',    label: 'Ambos' },
]

const emptyForm = {
  codigo: '', razon_social: '', rif: '', direccion: '',
  zona_id: '', vendedor_id: '', empresa: 'confibox',
  telefono: '', latitud: '', longitud: '', observaciones: '',
}

export default function TiendaForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { position, loading: gpsLoading, error: gpsError, getPosition } = useCurrentPosition()

  const [form, setForm] = useState(emptyForm)
  const [zonas, setZonas] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fotoFile, setFotoFile] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)

  useEffect(() => {
    getZonas().then((r) => setZonas(r.data))
    getUsuariosByRol('vendedor').then((r) => setVendedores(r.data)).catch(() => setVendedores([]))
  }, [])

  useEffect(() => {
    if (!isEdit) {
      setForm((f) => ({
        ...f,
        vendedor_id: user?.rol === 'vendedor' ? String(user.id) : '',
      }))
      return
    }
    getTienda(id)
      .then((r) => {
        const t = r.data
        setForm({
          codigo: t.codigo ?? '',
          razon_social: t.razon_social ?? '',
          rif: t.rif ?? '',
          direccion: t.direccion ?? '',
          zona_id: t.zona_id ?? '',
          vendedor_id: t.vendedor_id ?? '',
          empresa: t.empresa ?? 'confibox',
          telefono: t.telefono ?? '',
          latitud: t.latitud ?? '',
          longitud: t.longitud ?? '',
          observaciones: t.observaciones ?? '',
        })
      })
      .catch(() => toast.error('Error cargando tienda'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (position) {
      setForm((f) => ({ ...f, latitud: position.lat.toFixed(6), longitud: position.lng.toFixed(6) }))
    }
  }, [position])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleFotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      let foto_url = form.foto_url ?? null
      if (fotoFile) {
        const r = await uploadFile(fotoFile)
        foto_url = r.data.url
      }
      const payload = {
        ...form,
        foto_url,
        zona_id:     form.zona_id     || null,
        vendedor_id: form.vendedor_id || null,
        latitud:     form.latitud     === '' ? null : Number(form.latitud),
        longitud:    form.longitud    === '' ? null : Number(form.longitud),
      }
      if (isEdit) {
        await updateTienda(id, payload)
        toast.success('Tienda actualizada')
        navigate(`/tiendas/${id}`)
      } else {
        const r = await createTienda(payload)
        toast.success('Tienda creada')
        navigate(`/tiendas/${r.data.id}`)
      }
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-gray-400 text-sm">Cargando...</p>

  const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const lbl = 'block text-sm font-medium text-gray-700 mb-1'
  const previewTienda = form.latitud && form.longitud
    ? [{ id: 0, razon_social: form.razon_social || 'Tienda', latitud: Number(form.latitud), longitud: Number(form.longitud), empresa: form.empresa }]
    : []

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Link to={isEdit ? `/tiendas/${id}` : '/tiendas'} className="text-blue-600 text-sm hover:underline">← Volver</Link>
        <span className="text-gray-400">/</span>
        <h2 className="text-xl font-bold text-gray-800">{isEdit ? 'Editar tienda' : 'Nueva tienda'}</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-lg shadow p-5 space-y-4">
          <h3 className="font-semibold text-gray-700">Información general</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Código *</label>
              <input className={inp} value={form.codigo} onChange={(e) => set('codigo', e.target.value)} required disabled={isEdit} />
            </div>
            <div>
              <label className={lbl}>RIF</label>
              <input className={inp} value={form.rif} onChange={(e) => set('rif', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={lbl}>Razón social *</label>
            <input className={inp} value={form.razon_social} onChange={(e) => set('razon_social', e.target.value)} required />
          </div>

          <div>
            <label className={lbl}>Dirección</label>
            <textarea className={inp} rows={2} value={form.direccion} onChange={(e) => set('direccion', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Zona</label>
              <select className={inp} value={form.zona_id} onChange={(e) => set('zona_id', e.target.value)}>
                <option value="">Sin zona</option>
                {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Empresa *</label>
              <select className={inp} value={form.empresa} onChange={(e) => set('empresa', e.target.value)} required>
                {EMPRESAS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Vendedor</label>
              <select className={inp} value={form.vendedor_id} onChange={(e) => set('vendedor_id', e.target.value)}>
                <option value="">Sin asignar</option>
                {vendedores.map((v) => <option key={v.id} value={v.id}>{v.username}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Teléfono</label>
              <input className={inp} value={form.telefono} onChange={(e) => set('telefono', e.target.value)} placeholder="0414-1234567" />
            </div>
          </div>

          <div>
            <label className={lbl}>Observaciones</label>
            <textarea className={inp} rows={2} value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} placeholder="Opcional — horarios, accesos, contacto, etc." />
          </div>

          <div>
            <label className={lbl}>Foto de fachada</label>
            <div className="space-y-2">
              {(fotoPreview || form.foto_url) && (
                <img
                  src={fotoPreview ?? form.foto_url}
                  alt="Fachada"
                  className="w-full max-h-48 object-cover rounded-lg border border-gray-200"
                />
              )}
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <span className="text-sm border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50">
                  {fotoPreview || form.foto_url ? 'Cambiar foto' : '📷 Agregar foto'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFotoChange}
                />
              </label>
              {(fotoPreview || form.foto_url) && (
                <button
                  type="button"
                  onClick={() => { setFotoFile(null); setFotoPreview(null); set('foto_url', null) }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Quitar foto
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-5 space-y-3">
            <h3 className="font-semibold text-gray-700">Coordenadas GPS</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Latitud</label>
                <input className={inp} type="number" step="0.000001" value={form.latitud} onChange={(e) => set('latitud', e.target.value)} placeholder="10.234567" />
              </div>
              <div>
                <label className={lbl}>Longitud</label>
                <input className={inp} type="number" step="0.000001" value={form.longitud} onChange={(e) => set('longitud', e.target.value)} placeholder="-66.851234" />
              </div>
            </div>
            <button
              type="button"
              onClick={getPosition}
              disabled={gpsLoading}
              className="w-full border border-blue-500 text-blue-600 hover:bg-blue-50 text-sm py-2 rounded-md disabled:opacity-50"
            >
              {gpsLoading ? '📍 Obteniendo ubicación...' : '📍 Capturar mi ubicación actual'}
            </button>
            {gpsError && <p className="text-xs text-red-500">{gpsError}</p>}
            <p className="text-xs text-gray-400">
              Para mayor precisión, captura las coordenadas estando físicamente en la tienda.
            </p>
          </div>

          {previewTienda.length > 0 ? (
            <MapaTiendas tiendas={previewTienda} height="280px" />
          ) : (
            <div className="bg-white rounded-lg shadow flex items-center justify-center text-gray-400 text-sm h-[200px]">
              Sin coordenadas — captura para previsualizar el mapa.
            </div>
          )}
        </div>

        <div className="md:col-span-2 flex justify-end gap-3 pt-2">
          <Link
            to={isEdit ? `/tiendas/${id}` : '/tiendas'}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear tienda'}
          </button>
        </div>
      </form>
    </div>
  )
}
