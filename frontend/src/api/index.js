import axios from 'axios'
import { toast } from 'sonner'

const api = axios.create({ baseURL: '/api' })

let _unauthorizedHandler = null
export const setUnauthorizedHandler = (fn) => { _unauthorizedHandler = fn }

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!err.response) {
      toast.error('Sin conexión. Verifica tu red e intenta de nuevo.')
      return Promise.reject(err)
    }
    if (err.response.status === 401 && !err.config.url?.endsWith('/auth/login')) {
      if (_unauthorizedHandler) _unauthorizedHandler()
    }
    return Promise.reject(err)
  }
)

// ── Auth ───────────────────────────────────────────────────────────────────
export const authLogin = (data) => api.post('/auth/login', data)
export const getMe = () => api.get('/auth/me')
export const changePassword = (data) => api.put('/auth/change-password', data)
export const generateRecoveryCodes = () => api.post('/auth/generate-recovery-codes')
export const getRecoveryCodesCount = () => api.get('/auth/recovery-codes/count')
export const recoverWithCode = (data) => api.post('/auth/recover', data)

// ── Config empresa ─────────────────────────────────────────────────────────
export const getConfig = () => api.get('/config')
export const updateConfig = (data) => api.put('/config', data)

// ── Dashboard ──────────────────────────────────────────────────────────────
export const getDashboard = () => api.get('/dashboard')

// ── Maestras ───────────────────────────────────────────────────────────────
export const getZonas = () => api.get('/zonas')
export const createZona = (data) => api.post('/zonas', data)
export const updateZona = (id, data) => api.put(`/zonas/${id}`, data)
export const deleteZona = (id) => api.delete(`/zonas/${id}`)

export const getGruposProductos = () => api.get('/grupos-productos')
export const createGrupoProducto = (data) => api.post('/grupos-productos', data)
export const updateGrupoProducto = (id, data) => api.put(`/grupos-productos/${id}`, data)
export const deleteGrupoProducto = (id) => api.delete(`/grupos-productos/${id}`)

export const getGruposClientes = () => api.get('/grupos-clientes')
export const createGrupoCliente = (data) => api.post('/grupos-clientes', data)
export const updateGrupoCliente = (id, data) => api.put(`/grupos-clientes/${id}`, data)
export const deleteGrupoCliente = (id) => api.delete(`/grupos-clientes/${id}`)

// ── Tiendas (clientes) ─────────────────────────────────────────────────────
export const getTiendas = (params) => api.get('/clientes', { params })
export const getTienda = (id) => api.get(`/clientes/${id}`)
export const createTienda = (data) => api.post('/clientes', data)
export const updateTienda = (id, data) => api.put(`/clientes/${id}`, data)
export const deleteTienda = (id) => api.delete(`/clientes/${id}`)
export const reactivarTienda = (id) => api.post(`/clientes/${id}/reactivar`)

// ── Productos ──────────────────────────────────────────────────────────────
export const getProductos = (params) => api.get('/productos', { params })
export const getProducto = (id) => api.get(`/productos/${id}`)
export const createProducto = (data) => api.post('/productos', data)
export const updateProducto = (id, data) => api.put(`/productos/${id}`, data)
export const deleteProducto = (id) => api.delete(`/productos/${id}`)
export const reactivarProducto = (id) => api.post(`/productos/${id}/reactivar`)

// ── Inventario (lotes) ─────────────────────────────────────────────────────
export const getLotes = (params) => api.get('/inventario/lotes', { params })
export const createLote = (data) => api.post('/inventario/lotes', data)
export const updateLote = (id, data) => api.put(`/inventario/lotes/${id}`, data)
export const getStockConsolidado = () => api.get('/inventario/stock')
// WMS planner
export const getAlmacenZonas = () => api.get('/inventario/almacen-zonas')
export const createAlmacenZona = (data) => api.post('/inventario/almacen-zonas', data)
export const updateAlmacenZona = (id, data) => api.put(`/inventario/almacen-zonas/${id}`, data)
export const deleteAlmacenZona = (id) => api.delete(`/inventario/almacen-zonas/${id}`)
export const getUbicaciones = (params) => api.get('/inventario/ubicaciones', { params })
export const createUbicacion = (data) => api.post('/inventario/ubicaciones', data)
export const updateUbicacion = (id, data) => api.put(`/inventario/ubicaciones/${id}`, data)
export const deleteUbicacion = (id) => api.delete(`/inventario/ubicaciones/${id}`)
export const ubicarLote = (id, data) => api.put(`/inventario/lotes/${id}/ubicar`, data)
export const getAlmacenStock = () => api.get('/inventario/almacen-stock')
// Etiquetas (labels)
export const getEtiquetas = () => api.get('/inventario/etiquetas')
export const createEtiqueta = (data) => api.post('/inventario/etiquetas', data)
export const deleteEtiqueta = (id) => api.delete(`/inventario/etiquetas/${id}`)
export const assignEtiqueta = (ubicacionId, etiquetaId) =>
  api.post(`/inventario/ubicaciones/${ubicacionId}/etiquetas`, { etiqueta_id: etiquetaId })
export const unassignEtiqueta = (ubicacionId, etiquetaId) =>
  api.delete(`/inventario/ubicaciones/${ubicacionId}/etiquetas/${etiquetaId}`)

// ── Pedidos ────────────────────────────────────────────────────────────────
export const getPedidos = (params) => api.get('/pedidos', { params })
// Fetch multiple estados in one call: estados=['pendiente','facturado']
export const getPedidosByEstados = (estados, extra) =>
  api.get('/pedidos', { params: { ...extra, estado: estados.join(',') } })
export const getPedido = (id) => api.get(`/pedidos/${id}`)
export const createPedido = (data) => api.post('/pedidos', data)
export const facturarPedido = (id) => api.put(`/pedidos/${id}/facturar`)
export const anularPedido = (id) => api.put(`/pedidos/${id}/anular`)
export const getPickingList = (id) => api.get(`/pedidos/${id}/picking-list`)
export const iniciarRuta = (id, data) => api.put(`/pedidos/${id}/iniciar-ruta`, data)

// ── Entregas ───────────────────────────────────────────────────────────────
export const getMiRuta = () => api.get('/entregas/mi-ruta')
export const iniciarJornada = () => api.put('/entregas/iniciar-jornada')
export const getEntregas = (params) => api.get('/entregas', { params })
export const getEntrega = (id) => api.get(`/entregas/${id}`)
export const checkinEntrega = (id, data) => api.put(`/entregas/${id}/checkin`, data)
export const syncOffline = (queue) => api.post('/entregas/sync', { queue })
export const createDevolucionEntrega = (id, data) => api.post(`/entregas/${id}/devoluciones`, data)
export const getMapaEnVivo = () => api.get('/entregas/mapa-en-vivo')

// ── Jornada Equipo ─────────────────────────────────────────────────────────
export const getJornadaEquipo = (fecha) => api.get('/entregas/jornada-equipo', { params: fecha ? { fecha } : {} })
export const createJornadaEquipo = (data) => api.post('/entregas/jornada-equipo', data)
export const deleteJornadaEquipo = (id) => api.delete(`/entregas/jornada-equipo/${id}`)

// ── Uploads ────────────────────────────────────────────────────────────────
export const uploadFile = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } })
}

// ── Solicitudes georef ─────────────────────────────────────────────────────
export const getSolicitudes = (params) => api.get('/solicitudes-georef', { params })
export const createSolicitud = (data) => api.post('/solicitudes-georef', data)
export const aprobarSolicitud = (id) => api.put(`/solicitudes-georef/${id}/aprobar`)
export const rechazarSolicitud = (id) => api.put(`/solicitudes-georef/${id}/rechazar`)

// ── Usuarios ───────────────────────────────────────────────────────────────
export const getUsuarios = () => api.get('/usuarios')
export const getUsuariosByRol = (rol) => api.get('/usuarios/by-rol', { params: { rol } })
export const createUsuario = (data) => api.post('/usuarios', data)
export const updateUsuario = (id, data) => api.put(`/usuarios/${id}`, data)
export const deleteUsuario = (id) => api.delete(`/usuarios/${id}`)
