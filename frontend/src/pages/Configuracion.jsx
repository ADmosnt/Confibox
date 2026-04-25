import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  getConfig, updateConfig,
  getZonas, createZona, updateZona, deleteZona,
  getGruposProductos, createGrupoProducto, updateGrupoProducto, deleteGrupoProducto,
} from '../api'

function CatalogSection({ title, items, onCreate, onUpdate, onDelete }) {
  const [input, setInput] = useState('')
  const [editId, setEditId] = useState(null)
  const [editVal, setEditVal] = useState('')

  const handleCreate = async () => {
    if (!input.trim()) return
    await onCreate({ nombre: input.trim() })
    setInput('')
  }

  const handleUpdate = async (id) => {
    await onUpdate(id, { nombre: editVal })
    setEditId(null)
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 font-medium text-sm border-b">{title}</div>
      <div className="p-3 space-y-1 max-h-48 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            {editId === item.id ? (
              <>
                <input value={editVal} onChange={(e) => setEditVal(e.target.value)}
                  className="flex-1 border rounded px-2 py-1 text-sm" />
                <button onClick={() => handleUpdate(item.id)} className="text-xs text-green-600 hover:underline">Guardar</button>
                <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:underline">Cancelar</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{item.nombre}</span>
                <button onClick={() => { setEditId(item.id); setEditVal(item.nombre) }} className="text-xs text-blue-600 hover:underline">Editar</button>
                <button onClick={() => onDelete(item.id)} className="text-xs text-red-500 hover:underline">Eliminar</button>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-400 py-2">Sin registros</p>}
      </div>
      <div className="border-t p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Nombre..."
          className="flex-1 border rounded px-2 py-1.5 text-sm"
        />
        <button onClick={handleCreate} className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-700">+</button>
      </div>
    </div>
  )
}

export default function Configuracion() {
  const [config, setConfig] = useState({ nombre: '', rif: '', direccion: '', ciudad: '' })
  const [zonas, setZonas] = useState([])
  const [gruposProductos, setGruposProductos] = useState([])

  const loadAll = () => {
    getConfig().then((r) => setConfig(r.data))
    getZonas().then((r) => setZonas(r.data))
    getGruposProductos().then((r) => setGruposProductos(r.data))
  }
  useEffect(() => { loadAll() }, [])

  const saveConfig = async (e) => {
    e.preventDefault()
    try {
      await updateConfig(config)
      toast.success('Configuración guardada')
    } catch {
      toast.error('Error al guardar la configuración')
    }
  }

  const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Configuración</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Datos de la empresa</h3>
          <form onSubmit={saveConfig} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre / Razón Social</label>
              <input className={inp} value={config.nombre} onChange={(e) => setConfig({ ...config, nombre: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RIF</label>
              <input className={inp} value={config.rif} onChange={(e) => setConfig({ ...config, rif: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <textarea className={inp} rows={2} value={config.direccion} onChange={(e) => setConfig({ ...config, direccion: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input className={inp} value={config.ciudad} onChange={(e) => setConfig({ ...config, ciudad: e.target.value })} required />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white text-sm py-2 rounded-md hover:bg-blue-700">Guardar</button>
          </form>
        </div>

        <div className="space-y-4">
          <CatalogSection title="Zonas" items={zonas}
            onCreate={async (d) => { await createZona(d); getZonas().then((r) => setZonas(r.data)) }}
            onUpdate={async (id, d) => { await updateZona(id, d); getZonas().then((r) => setZonas(r.data)) }}
            onDelete={async (id) => { await deleteZona(id); getZonas().then((r) => setZonas(r.data)) }}
          />
          <CatalogSection title="Grupos de productos" items={gruposProductos}
            onCreate={async (d) => { await createGrupoProducto(d); getGruposProductos().then((r) => setGruposProductos(r.data)) }}
            onUpdate={async (id, d) => { await updateGrupoProducto(id, d); getGruposProductos().then((r) => setGruposProductos(r.data)) }}
            onDelete={async (id) => { await deleteGrupoProducto(id); getGruposProductos().then((r) => setGruposProductos(r.data)) }}
          />
        </div>
      </div>
    </div>
  )
}
