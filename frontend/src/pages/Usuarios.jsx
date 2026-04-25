import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getUsuarios, createUsuario, updateUsuario } from '../api'
import { Dialog, DialogContent } from '../components/ui/Dialog'
import Alert from '../components/Alert'

const ROLES = [
  { value: 'admin',       label: 'Administrador' },
  { value: 'vendedor',    label: 'Vendedor' },
  { value: 'facturacion', label: 'Facturación' },
  { value: 'almacenista', label: 'Almacenista' },
  { value: 'chofer',      label: 'Chofer' },
]

const ROL_BADGE = {
  admin:       'bg-purple-100 text-purple-700',
  vendedor:    'bg-blue-100 text-blue-700',
  facturacion: 'bg-yellow-100 text-yellow-700',
  almacenista: 'bg-green-100 text-green-700',
  chofer:      'bg-orange-100 text-orange-700',
}

const ROL_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label]))

function UsuarioModal({ open, onClose, onSaved }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState('vendedor')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setUsername(''); setPassword(''); setRol('vendedor'); setError('')
  }, [open])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createUsuario({ username, password, rol })
      toast.success(`Usuario "${username}" creado`)
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al crear usuario')
    } finally {
      setLoading(false)
    }
  }

  const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const lbl = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Nuevo Usuario" size="md">
        <Alert type="error" message={error} />
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={lbl}>Nombre de usuario *</label>
            <input className={inp} value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className={lbl}>Contraseña *</label>
            <input type="password" className={inp} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label className={lbl}>Rol</label>
            <select className={inp} value={rol} onChange={(e) => setRol(e.target.value)}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [modalOpen, setModalOpen] = useState(false)

  const load = () =>
    getUsuarios()
      .then((r) => setUsuarios(r.data))
      .catch(() => toast.error('Error al cargar usuarios'))

  useEffect(() => { load() }, [])

  const toggleActivo = async (u) => {
    try {
      await updateUsuario(u.id, { activo: !u.activo })
      toast.success(u.activo ? `"${u.username}" desactivado` : `"${u.username}" activado`)
      load()
    } catch {
      toast.error('Error al actualizar usuario')
    }
  }

  const cambiarRol = async (u, nuevoRol) => {
    if (nuevoRol === u.rol) return
    try {
      await updateUsuario(u.id, { rol: nuevoRol })
      toast.success(`Rol de "${u.username}" actualizado`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al actualizar rol')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-800">Usuarios</h2>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md"
        >
          + Nuevo usuario
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Usuario</th>
              <th className="px-4 py-3 text-left">Rol</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usuarios.map((u) => (
              <tr key={u.id} className={`hover:bg-gray-50 ${!u.activo ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium font-mono">{u.username}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.rol}
                    onChange={(e) => cambiarRol(u, e.target.value)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer ${ROL_BADGE[u.rol] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActivo(u)}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">No hay usuarios registrados</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <UsuarioModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} />
    </div>
  )
}
