// Pedido estado chip — used across Pedidos, PedidoDetalle, Dashboard
const PEDIDO_COLOR = {
  pendiente:      'bg-gray-100 text-gray-700',
  facturado:      'bg-blue-100 text-blue-700',
  en_ruta:        'bg-yellow-100 text-yellow-700',
  entregado:      'bg-green-100 text-green-700',
  con_incidencia: 'bg-orange-100 text-orange-700',
  anulado:        'bg-red-100 text-red-700',
}
const PEDIDO_LABEL = {
  pendiente:      'Pendiente',
  facturado:      'Facturado',
  en_ruta:        'En ruta',
  entregado:      'Entregado',
  con_incidencia: 'Incidencia',
  anulado:        'Anulado',
}

export function EstadoBadge({ estado }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PEDIDO_COLOR[estado] ?? 'bg-gray-100 text-gray-600'}`}>
      {PEDIDO_LABEL[estado] ?? estado}
    </span>
  )
}

// Entrega (delivery check-in) estado chip — used across Entregas, MiRuta
const ENTREGA_COLOR = {
  pendiente:     'bg-gray-100 text-gray-700',
  entregada:     'bg-green-100 text-green-700',
  rechazada:     'bg-red-100 text-red-700',
  local_cerrado: 'bg-orange-100 text-orange-700',
  parcial:       'bg-yellow-100 text-yellow-700',
}
const ENTREGA_LABEL = {
  pendiente:     'Pendiente',
  entregada:     'Entregada',
  rechazada:     'Rechazada',
  local_cerrado: 'Local cerrado',
  parcial:       'Parcial',
}

export function EntregaEstadoBadge({ estado }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ENTREGA_COLOR[estado] ?? 'bg-gray-100 text-gray-600'}`}>
      {ENTREGA_LABEL[estado] ?? estado}
    </span>
  )
}

export { ENTREGA_COLOR, ENTREGA_LABEL, PEDIDO_COLOR, PEDIDO_LABEL }
