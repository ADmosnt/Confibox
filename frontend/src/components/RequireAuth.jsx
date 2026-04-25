import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const DEFAULT_ROUTE = {
  admin: '/dashboard',
  vendedor: '/tiendas',
  facturacion: '/pedidos',
  almacenista: '/inventario',
  chofer: '/mi-ruta',
}

// roles can be a string or an array of strings
export default function RequireAuth({ children, roles }) {
  const { user } = useAuth()

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Cargando...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (roles) {
    const allowed = Array.isArray(roles) ? roles : [roles]
    if (!allowed.includes(user.rol)) {
      return <Navigate to={DEFAULT_ROUTE[user.rol] ?? '/login'} replace />
    }
  }

  return children
}
