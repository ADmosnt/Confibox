import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import {
  getConfig, updateConfig,
  getZonas, createZona, updateZona, deleteZona,
  getGruposProductos, createGrupoProducto, updateGrupoProducto, deleteGrupoProducto,
  getGruposClientes, createGrupoCliente, updateGrupoCliente, deleteGrupoCliente,
  changePassword, generateRecoveryCodes, getRecoveryCodesCount,
} from '../api'

function CatalogSection({ title, items, onCreate, onUpdate, onDelete }) {
  const [input, setInput] = useState('')
  const [editId, setEditId] = useState(null)
  const [editVal, setEditVal] = useState('')

  const handleCreate = async () => {
    if (!input.trim()) return
    try {
      await onCreate({ nombre: input.trim() })
      setInput('')
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al crear')
    }
  }

  const handleUpdate = async (id) => {
    try {
      await onUpdate(id, { nombre: editVal })
      setEditId(null)
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al guardar')
    }
  }

  const handleDelete = async (id) => {
    try {
      await onDelete(id)
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'No se puede eliminar')
    }
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
                <button onClick={() => handleDelete(item.id)} className="text-xs text-red-500 hover:underline">Eliminar</button>
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

function MiCuenta() {
  const { user } = useAuth()
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  const [activeCount, setActiveCount] = useState(null)
  const [generatedCodes, setGeneratedCodes] = useState(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    getRecoveryCodesCount().then((r) => setActiveCount(r.data.active)).catch(() => {})
  }, [])

  const handleChangePw = async (e) => {
    e.preventDefault()
    if (newPw !== confirmPw) { toast.error('Las contraseñas nuevas no coinciden'); return }
    setPwSaving(true)
    try {
      await changePassword({ current_password: currentPw, new_password: newPw })
      toast.success('Contraseña actualizada')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al cambiar contraseña')
    } finally {
      setPwSaving(false)
    }
  }

  const handleGenerateCodes = async () => {
    if (!window.confirm('Esto invalidará los códigos anteriores. ¿Continuar?')) return
    setGenerating(true)
    try {
      const r = await generateRecoveryCodes()
      setGeneratedCodes(r.data.codes)
      setActiveCount(r.data.codes.length)
      toast.success('Códigos generados — guárdalos en un lugar seguro')
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al generar códigos')
    } finally {
      setGenerating(false)
    }
  }

  const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-5">
      <h3 className="font-semibold text-gray-700">Mi Cuenta</h3>

      <div className="text-sm text-gray-600">
        Usuario: <span className="font-medium text-gray-800">{user?.username}</span>
        <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{user?.rol}</span>
      </div>

      {/* Change password */}
      <form onSubmit={handleChangePw} className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Cambiar contraseña</p>
        <input type="password" placeholder="Contraseña actual" value={currentPw}
          onChange={(e) => setCurrentPw(e.target.value)} className={inp} required />
        <input type="password" placeholder="Nueva contraseña (mín. 6 caracteres)" value={newPw}
          onChange={(e) => setNewPw(e.target.value)} className={inp} required />
        <input type="password" placeholder="Confirmar nueva contraseña" value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)} className={inp} required />
        <button type="submit" disabled={pwSaving}
          className="w-full bg-blue-600 text-white text-sm py-2 rounded-md hover:bg-blue-700 disabled:opacity-50">
          {pwSaving ? 'Guardando...' : 'Actualizar contraseña'}
        </button>
      </form>

      {/* Recovery codes */}
      <div className="border-t pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Códigos de recuperación</p>
            {activeCount !== null && (
              <p className="text-xs text-gray-500 mt-0.5">
                {activeCount > 0 ? `${activeCount} código(s) activo(s)` : 'Sin códigos activos'}
              </p>
            )}
          </div>
          <button onClick={handleGenerateCodes} disabled={generating}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded disabled:opacity-50">
            {generating ? 'Generando...' : 'Generar nuevos códigos'}
          </button>
        </div>

        {generatedCodes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs font-medium text-yellow-800 mb-2">
              Guarda estos códigos ahora — no se mostrarán de nuevo:
            </p>
            <div className="grid grid-cols-2 gap-1">
              {generatedCodes.map((c, i) => (
                <code key={i} className="text-xs bg-white border border-yellow-200 rounded px-2 py-1 font-mono">
                  {c}
                </code>
              ))}
            </div>
            <button onClick={() => setGeneratedCodes(null)}
              className="mt-2 text-xs text-yellow-700 hover:underline">
              Los guardé, cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Configuracion() {
  const [config, setConfig] = useState({ nombre: '', rif: '', direccion: '', ciudad: '' })
  const [zonas, setZonas] = useState([])
  const [gruposProductos, setGruposProductos] = useState([])
  const [gruposClientes, setGruposClientes] = useState([])

  useEffect(() => {
    getConfig().then((r) => setConfig(r.data))
    getZonas().then((r) => setZonas(r.data))
    getGruposProductos().then((r) => setGruposProductos(r.data))
    getGruposClientes().then((r) => setGruposClientes(r.data))
  }, [])

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
        <div className="space-y-6">
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

          <MiCuenta />
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
          <CatalogSection title="Grupos de clientes" items={gruposClientes}
            onCreate={async (d) => { await createGrupoCliente(d); getGruposClientes().then((r) => setGruposClientes(r.data)) }}
            onUpdate={async (id, d) => { await updateGrupoCliente(id, d); getGruposClientes().then((r) => setGruposClientes(r.data)) }}
            onDelete={async (id) => { await deleteGrupoCliente(id); getGruposClientes().then((r) => setGruposClientes(r.data)) }}
          />
        </div>
      </div>
    </div>
  )
}
