from flask import Blueprint, jsonify, request
import datetime
from app import db
from app.models import Pedido, PedidoDetalle, Lote, Cliente, Producto, Usuario, EntregaDiaria
from app.auth import require_role, get_current_user
from app.utils import siguiente_numero_pedido

bp = Blueprint('pedidos', __name__)

ESTADOS_ACTIVOS = ('pendiente', 'facturado', 'en_ruta')


# ── Helpers ────────────────────────────────────────────────────────────────────

def _build_picking_list(pedido, lock=False):
    """FEFO picking list for a pedido. Returns per-product extraction plan.

    lock=True acquires row-level locks on lotes so concurrent iniciar_ruta
    calls cannot double-deduct from the same stock.
    """
    result = []
    for det in pedido.detalles:
        p = det.producto
        upb = p.unidades_por_bulto
        total_uds = (det.cantidad_bultos * upb) + det.cantidad_unidades

        q = (
            Lote.query
            .filter(Lote.producto_id == det.producto_id, Lote.cantidad_bultos > 0)
            .order_by(Lote.fecha_vencimiento.asc().nullslast(), Lote.fecha_ingreso)
        )
        if lock:
            q = q.with_for_update()
        lotes = q.all()

        stock_total = sum(l.cantidad_bultos * upb for l in lotes)
        restantes = total_uds
        extraccion = []

        for lote in lotes:
            if restantes <= 0:
                break
            uds_lote = lote.cantidad_bultos * upb
            a_sacar = min(uds_lote, restantes)
            extraccion.append({
                'lote_id': lote.id,
                'numero_lote': lote.numero_lote,
                'ubicacion': lote.ubicacion_almacen,
                'fecha_vencimiento': lote.fecha_vencimiento.isoformat() if lote.fecha_vencimiento else None,
                'bultos_a_sacar': a_sacar // upb,
                'unidades_sueltas_a_sacar': a_sacar % upb,
            })
            restantes -= a_sacar

        result.append({
            'producto_id': det.producto_id,
            'codigo': p.codigo,
            'descripcion': p.descripcion,
            'unidades_por_bulto': upb,
            'cantidad_pedida_bultos': det.cantidad_bultos,
            'cantidad_pedida_unidades': det.cantidad_unidades,
            'total_unidades': total_uds,
            'stock_disponible': stock_total,
            'deficit': max(0, restantes),
            'extraccion': extraccion,
        })
    return result


# ── Endpoints ──────────────────────────────────────────────────────────────────

@bp.route('', methods=['GET'])
@require_role('admin', 'vendedor', 'facturacion', 'almacenista')
def list_pedidos():
    q = Pedido.query
    estado = request.args.get('estado')
    if estado:
        # Allow comma-separated: ?estado=pendiente,facturado
        estados = [e.strip() for e in estado.split(',') if e.strip()]
        q = q.filter(Pedido.estado.in_(estados))
    tienda_id = request.args.get('tienda_id')
    if tienda_id:
        q = q.filter(Pedido.tienda_id == int(tienda_id))
    vendedor_id = request.args.get('vendedor_id')
    if vendedor_id:
        q = q.filter(Pedido.vendedor_id == int(vendedor_id))
    fecha = request.args.get('fecha')
    if fecha:
        try:
            d = datetime.date.fromisoformat(fecha)
            q = q.filter(
                Pedido.creado_en >= datetime.datetime.combine(d, datetime.time.min),
                Pedido.creado_en <= datetime.datetime.combine(d, datetime.time.max),
            )
        except ValueError:
            return jsonify({'error': 'fecha inválida (YYYY-MM-DD)'}), 400
    pedidos = q.order_by(Pedido.creado_en.desc()).all()
    return jsonify([p.to_dict() for p in pedidos])


@bp.route('/<int:id>', methods=['GET'])
@require_role('admin', 'vendedor', 'facturacion', 'almacenista', 'chofer')
def get_pedido(id):
    pedido = Pedido.query.get_or_404(id)
    return jsonify(pedido.to_dict(include_detalles=True))


@bp.route('', methods=['POST'])
@require_role('admin', 'vendedor')
def create_pedido():
    data = request.get_json() or {}
    if not data.get('tienda_id'):
        return jsonify({'error': 'tienda_id es requerido'}), 400
    if not data.get('detalles'):
        return jsonify({'error': 'detalles es requerido (lista no vacía)'}), 400

    Cliente.query.get_or_404(data['tienda_id'])
    user = get_current_user()

    pedido = Pedido(
        numero_pedido=siguiente_numero_pedido(db, Pedido),
        tienda_id=data['tienda_id'],
        vendedor_id=user.id,
        nota=data.get('nota'),
    )
    db.session.add(pedido)
    db.session.flush()

    for det in data['detalles']:
        if not det.get('producto_id'):
            return jsonify({'error': 'Cada detalle requiere producto_id'}), 400
        Producto.query.get_or_404(det['producto_id'])
        db.session.add(PedidoDetalle(
            pedido_id=pedido.id,
            producto_id=det['producto_id'],
            cantidad_bultos=int(det.get('cantidad_bultos', 0)),
            cantidad_unidades=int(det.get('cantidad_unidades', 0)),
        ))

    db.session.commit()
    return jsonify(pedido.to_dict(include_detalles=True)), 201


@bp.route('/<int:id>/facturar', methods=['PUT'])
@require_role('admin', 'facturacion')
def facturar_pedido(id):
    pedido = Pedido.query.get_or_404(id)
    if pedido.estado != 'pendiente':
        return jsonify({'error': f"Solo se pueden facturar pedidos pendientes (estado actual: {pedido.estado})"}), 409
    user = get_current_user()
    pedido.estado = 'facturado'
    pedido.facturado_por = user.id
    pedido.facturado_en = datetime.datetime.utcnow()
    db.session.commit()
    return jsonify(pedido.to_dict())


@bp.route('/<int:id>/anular', methods=['PUT'])
@require_role('admin')
def anular_pedido(id):
    pedido = Pedido.query.get_or_404(id)
    if pedido.estado == 'entregado':
        return jsonify({'error': 'No se puede anular un pedido ya entregado'}), 409
    if pedido.estado == 'anulado':
        return jsonify({'error': 'El pedido ya está anulado'}), 409

    # If already dispatched (en_ruta), revert stock
    if pedido.estado == 'en_ruta':
        _revertir_stock(pedido)

    pedido.estado = 'anulado'
    db.session.commit()
    return jsonify(pedido.to_dict())


def _revertir_stock(pedido):
    """Return dispatched units back to their lotes (last-in, first-out by fecha_ingreso).

    Uses divmod so remainder units < 1 bulto get rounded up as a partial bulto
    on the last touched lote — consistent with how iniciar_ruta rounds down on
    deduction (the almacenista handles partial bultos physically in both cases).
    """
    for det in pedido.detalles:
        upb = det.producto.unidades_por_bulto
        uds_restantes = (det.cantidad_bultos * upb) + det.cantidad_unidades
        lotes = (
            Lote.query
            .filter(Lote.producto_id == det.producto_id)
            .order_by(Lote.fecha_ingreso.desc())
            .all()
        )
        last_lote = None
        for lote in lotes:
            if uds_restantes < upb:
                break
            last_lote = lote
            bultos, uds_restantes = divmod(uds_restantes, upb)
            lote.cantidad_bultos += bultos
        # Remainder < 1 bulto: credit as 1 partial bulto so no units vanish
        if uds_restantes > 0 and last_lote:
            last_lote.cantidad_bultos += 1


@bp.route('/<int:id>/picking-list', methods=['GET'])
@require_role('admin', 'almacenista')
def picking_list(id):
    pedido = Pedido.query.get_or_404(id)
    if pedido.estado not in ('facturado', 'en_ruta'):
        return jsonify({'error': 'El pedido debe estar facturado para ver el picking list'}), 409
    return jsonify({
        'pedido': pedido.to_dict(),
        'picking': _build_picking_list(pedido),
    })


@bp.route('/<int:id>/iniciar-ruta', methods=['PUT'])
@require_role('admin', 'almacenista')
def iniciar_ruta(id):
    pedido = Pedido.query.get_or_404(id)
    if pedido.estado != 'facturado':
        return jsonify({'error': f"Solo se puede iniciar ruta de pedidos facturados (estado actual: {pedido.estado})"}), 409

    data = request.get_json() or {}
    chofer_id = data.get('chofer_id')
    if not chofer_id:
        return jsonify({'error': 'chofer_id es requerido'}), 400
    chofer = Usuario.query.get_or_404(chofer_id)
    if chofer.rol != 'chofer':
        return jsonify({'error': 'El usuario indicado no tiene rol chofer'}), 400

    # Lock lotes and verify stock. with_for_update() prevents two concurrent
    # iniciar_ruta calls from double-deducting the same inventory rows.
    picking = _build_picking_list(pedido, lock=True)
    deficits = [r for r in picking if r['deficit'] > 0]
    if deficits:
        faltantes = ', '.join(f"{r['descripcion']} (faltan {r['deficit']} uds)" for r in deficits)
        return jsonify({'error': f'Stock insuficiente: {faltantes}'}), 409

    for item in picking:
        for ext in item['extraccion']:
            lote = Lote.query.get(ext['lote_id'])
            uds_a_sacar = (ext['bultos_a_sacar'] * item['unidades_por_bulto']) + ext['unidades_sueltas_a_sacar']
            lote.cantidad_bultos -= uds_a_sacar // item['unidades_por_bulto']
            # Remaining sueltas reduce the next bulto (partial bulto becomes negative, handled by almacenista)

    pedido.estado = 'en_ruta'

    entrega = EntregaDiaria(
        pedido_id=pedido.id,
        chofer_id=chofer_id,
        estado='pendiente',
    )
    db.session.add(entrega)
    db.session.commit()
    return jsonify(pedido.to_dict())
