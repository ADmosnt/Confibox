import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { getProductos, deleteProducto, reactivarProducto, getGruposProductos } from '../api'
import ProductoModal from '../components/ProductoModal'

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [desactivados, setDesactivados] = useState([])
  const [grupos, setGrupos] = useState([])
  const [searchParams] = useSearchParams()
  const urlSearch = searchParams.get('search') ?? ''
  const [search, setSearch] = useState(urlSearch)
  const [grupoId, setGrupoId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [showDesactivados, setShowDesactivados] = useState(false)

  useEffect(() => { setSearch(urlSearch) }, [urlSearch])

  const load = () => {
    getProductos({ search, grupo_id: grupoId || undefined, activo: true })
      .then((r) => setProductos(r.data))
      .catch(() => toast.error('Error al cargar productos'))
    getProductos({ activo: false })
      .then((r) => setDesactivados(r.data))
      .catch(() => {})
  }

  useEffect(() => { getGruposProductos().then((r) => setGrupos(r.data)) }, [])
  useEffect(() => { load() }, [search, grupoId])

  const openNew = () => { setEditId(null); setModalOpen(true) }
  const openEdit = (id) => { setEditId(id); setModalOpen(true) }

  const handleDelete = async (id, desc) => {
    if (!confirm(`¿Desactivar "${desc}"?`)) return
    try {
      await deleteProducto(id)
      toast.success(`"${desc}" desactivado`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al desactivar producto')
    }
  }

  const handleReactivar = async (id, desc) => {
    try {
      await reactivarProducto(id)
      toast.success(`"${desc}" reactivado`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al reactivar producto')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-800">Productos</h2>
        <button
          onClick={openNew}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md"
        >
          + Nuevo producto
        </button>
      </div>

      <div className="bg-white rounded-lg shadow mb-4">
        <div className="p-4 border-b flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Buscar por descripción o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={grupoId}
            onChange={(e) => setGrupoId(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los grupos</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-left">Grupo</th>
                <th className="px-4 py-3 text-center">Uds/Bulto</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {productos.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{p.codigo}</td>
                  <td className="px-4 py-3 font-medium">{p.descripcion}</td>
                  <td className="px-4 py-3 text-gray-600">{p.grupo ?? '—'}</td>
                  <td className="px-4 py-3 text-center">{p.unidades_por_bulto}</td>
                  <td className="px-4 py-3 text-center space-x-2">
                    <button onClick={() => openEdit(p.id)} className="text-blue-600 hover:underline text-xs">Editar</button>
                    <button onClick={() => handleDelete(p.id, p.descripcion)} className="text-red-500 hover:underline text-xs">Desactivar</button>
                  </td>
                </tr>
              ))}
              {productos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No hay productos registrados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {desactivados.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <button
            onClick={() => setShowDesactivados((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 rounded-lg"
          >
            <span className="font-medium">Productos desactivados ({desactivados.length})</span>
            <span>{showDesactivados ? '▲' : '▼'}</span>
          </button>
          {showDesactivados && (
            <div className="overflow-x-auto border-t">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Código</th>
                    <th className="px-4 py-3 text-left">Descripción</th>
                    <th className="px-4 py-3 text-left">Grupo</th>
                    <th className="px-4 py-3 text-center">Uds/Bulto</th>
                    <th className="px-4 py-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {desactivados.map((p) => (
                    <tr key={p.id} className="bg-gray-50 opacity-75">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.codigo}</td>
                      <td className="px-4 py-3 text-gray-500 line-through">{p.descripcion}</td>
                      <td className="px-4 py-3 text-gray-400">{p.grupo ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-gray-400">{p.unidades_por_bulto}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleReactivar(p.id, p.descripcion)}
                          className="text-green-600 hover:underline text-xs font-medium"
                        >
                          Reactivar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ProductoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        productoId={editId}
        onSaved={load}
      />
    </div>
  )
}
