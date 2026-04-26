import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authLogin, recoverWithCode } from '../api'
import { useAuth } from '../context/AuthContext'
import Alert from '../components/Alert'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('normal') // 'normal' | 'recovery'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSuccess = (token, user) => {
    login(token, user)
    navigate(user.rol === 'cliente' ? '/mis-ordenes' : '/dashboard', { replace: true })
  }

  const submitLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await authLogin({ username, password })
      handleSuccess(r.data.token, r.data.user)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const submitRecovery = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await recoverWithCode({ username, recovery_code: recoveryCode })
      handleSuccess(r.data.token, r.data.user)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Código inválido o usuario no encontrado')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setPassword('')
    setRecoveryCode('')
  }

  const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Sistema de Consignación</h1>
        <p className="text-sm text-gray-500 mb-6">
          {mode === 'normal' ? 'Inicia sesión para continuar' : 'Acceso con código de recuperación'}
        </p>
        <Alert type="error" message={error} />

        {mode === 'normal' ? (
          <form onSubmit={submitLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
              <input autoFocus className={inp} value={username}
                onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input type="password" className={inp} value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md disabled:opacity-50">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
            <button type="button" onClick={() => switchMode('recovery')}
              className="w-full text-xs text-gray-400 hover:text-gray-600 text-center mt-1">
              ¿Olvidaste tu contraseña? Usar código de recuperación
            </button>
          </form>
        ) : (
          <form onSubmit={submitRecovery} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
              <input autoFocus className={inp} value={username}
                onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código de recuperación</label>
              <input className={inp} value={recoveryCode} placeholder="Ej: abc123def456gh78"
                onChange={(e) => setRecoveryCode(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-md disabled:opacity-50">
              {loading ? 'Verificando...' : 'Acceder con código'}
            </button>
            <button type="button" onClick={() => switchMode('normal')}
              className="w-full text-xs text-gray-400 hover:text-gray-600 text-center mt-1">
              ← Volver al login normal
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
