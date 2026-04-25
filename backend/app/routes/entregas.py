import math
import datetime
from flask import Blueprint, jsonify, request
from app import db
from app.models import EntregaDiaria, EntregaDevolucion, Pedido, Lote, Producto
from app.auth import require_role, get_current_user

bp = Blueprint('entregas', __name__)

DISTANCIA_MAXIMA_METROS = 50
MOTIVOS_INCIDENCIA = ('local_cerrado', 'no_recibio', 'sin_pago', 'no_estaba_encargado', 'otro')
MOTIVOS_DEVOLUCION = ('error_pedido', 'mercancia_danada', 'cliente_no_recibio', 'otro')


def _haversine(lat1, lon1, lat2, lon2):
    """Distance in meters between two GPS coordinates."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return int(2 * R * math.asin(math.sqrt(a)))


# ── Iniciar jornada (chofer confirms departure) ────────────────────────────────

@bp.route('/iniciar-jornada', methods=['PUT'])
@require_role('chofer', 'admin')
def iniciar_jornada():
    """Stamp salida_en on all pending entregas for today's chofer.
    Idempotent: re-calling after departure just returns current state."""
    user = get_current_user()
    chofer_id = user.id if user.rol == 'chofer' else request.get_json().get('chofer_id', user.id)

    hoy = datetime.date.today()
    entregas = (
        EntregaDiaria.query
        .filter(EntregaDiaria.chofer_id == chofer_id)
        .join(Pedido)
        .filter(Pedido.estado == 'en_ruta')
        .all()
    )

    if not entregas:
        return jsonify({'error': 'No hay entregas pendientes asignadas'}), 404

    ahora = datetime.datetime.utcnow()
    ya_salio = all(e.salida_en is not None for e in entregas)

    if not ya_salio:
        for e in entregas:
            if e.salida_en is None:
                e.salida_en = ahora
        db.session.commit()

    return jsonify({
        'salida_en': ahora.isoformat() if not ya_salio else entregas[0].salida_en.isoformat(),
        'entregas_actualizadas': 0 if ya_salio else len(entregas),
        'ya_habia_salido': ya_salio,
    })


# ── Mi ruta (chofer) ───────────────────────────────────────────────────────────

@bp.route('/mi-ruta', methods=['GET'])
@require_role('chofer', 'admin')
def mi_ruta():
    user = get_current_user()
    chofer_id = user.id if user.rol == 'chofer' else request.args.get('chofer_id', user.id)

    entregas = (
        EntregaDiaria.query
        .filter(EntregaDiaria.chofer_id == chofer_id)
        .join(Pedido)
        .filter(Pedido.estado == 'en_ruta')
        .order_by(EntregaDiaria.id)
        .all()
    )

    result = []
    for e in entregas:
        d = e.to_dict()
        pedido = e.pedido
        tienda = pedido.tienda
        d['pedido'] = pedido.to_dict(include_detalles=True)
        d['tienda'] = tienda.to_dict() if tienda else None
        result.append(d)

    return jsonify(result)


# ── Listar entregas ────────────────────────────────────────────────────────────

@bp.route('', methods=['GET'])
@require_role('admin', 'almacenista', 'chofer')
def list_entregas():
    user = get_current_user()
    q = EntregaDiaria.query

    if user.rol == 'chofer':
        q = q.filter(EntregaDiaria.chofer_id == user.id)
    else:
        chofer_id = request.args.get('chofer_id')
        if chofer_id:
            q = q.filter(EntregaDiaria.chofer_id == int(chofer_id))
    estado = request.args.get('estado')
    if estado:
        q = q.filter(EntregaDiaria.estado == estado)
    fecha = request.args.get('fecha')
    if fecha:
        try:
            d = datetime.date.fromisoformat(fecha)
            q = q.filter(
                EntregaDiaria.hora_registro >= datetime.datetime.combine(d, datetime.time.min),
                EntregaDiaria.hora_registro <= datetime.datetime.combine(d, datetime.time.max),
            )
        except ValueError:
            return jsonify({'error': 'fecha inválida (YYYY-MM-DD)'}), 400
    entregas = q.order_by(EntregaDiaria.hora_registro.desc()).all()
    return jsonify([e.to_dict(include_devoluciones=True) for e in entregas])


@bp.route('/<int:id>', methods=['GET'])
@require_role('admin', 'almacenista', 'chofer')
def get_entrega(id):
    e = EntregaDiaria.query.get_or_404(id)
    d = e.to_dict(include_devoluciones=True)
    d['pedido'] = e.pedido.to_dict(include_detalles=True)
    d['tienda'] = e.pedido.tienda.to_dict() if e.pedido.tienda else None
    return jsonify(d)


# ── Check-in (registrar entrega) ───────────────────────────────────────────────

@bp.route('/<int:id>/checkin', methods=['PUT'])
@require_role('chofer', 'admin')
def checkin(id):
    entrega = EntregaDiaria.query.get_or_404(id)
    user = get_current_user()

    if user.rol == 'chofer' and entrega.chofer_id != user.id:
        return jsonify({'error': 'Sin permiso: esta entrega no te corresponde'}), 403

    if entrega.estado not in ('pendiente', 'parcial'):
        return jsonify({'error': f'Esta entrega ya fue cerrada (estado: {entrega.estado})'}), 409

    data = request.get_json() or {}
    estado = data.get('estado')
    estados_validos = ('entregada', 'rechazada', 'local_cerrado', 'parcial')
    if estado not in estados_validos:
        return jsonify({'error': f"estado debe ser uno de: {', '.join(estados_validos)}"}), 400

    lat = data.get('latitud')
    lon = data.get('longitud')

    distancia = None
    tienda = entrega.pedido.tienda if entrega.pedido else None

    if lat is not None and lon is not None and tienda and tienda.latitud and tienda.longitud:
        distancia = _haversine(float(lat), float(lon), float(tienda.latitud), float(tienda.longitud))
        entrega.latitud_checkin = lat
        entrega.longitud_checkin = lon
        entrega.distancia_metros = distancia

        if distancia > DISTANCIA_MAXIMA_METROS and estado == 'entregada':
            motivo = data.get('motivo_incidencia')
            if not motivo:
                return jsonify({
                    'error': f'Estás a {distancia}m de la tienda (máximo {DISTANCIA_MAXIMA_METROS}m). '
                             'Proporciona motivo_incidencia para registrar de igual modo.',
                    'distancia_metros': distancia,
                    'requiere_motivo': True,
                }), 422

    motivo = data.get('motivo_incidencia')
    if estado in ('rechazada', 'local_cerrado') and not motivo:
        return jsonify({'error': 'motivo_incidencia es requerido para este estado'}), 400
    if motivo and motivo not in MOTIVOS_INCIDENCIA:
        return jsonify({'error': f"motivo_incidencia debe ser uno de: {', '.join(MOTIVOS_INCIDENCIA)}"}), 400

    entrega.estado = estado
    entrega.motivo_incidencia = motivo
    entrega.observacion = data.get('observacion')
    entrega.foto_evidencia_url = data.get('foto_evidencia_url')
    entrega.hora_registro = datetime.datetime.utcnow()
    entrega.sincronizado_en = datetime.datetime.utcnow()

    # Update parent pedido estado
    pedido = entrega.pedido
    if estado == 'entregada':
        pedido.estado = 'entregado'
    elif estado in ('rechazada', 'local_cerrado'):
        pedido.estado = 'con_incidencia'

    db.session.commit()
    return jsonify(entrega.to_dict(include_devoluciones=True))


# ── Sync offline queue ─────────────────────────────────────────────────────────

@bp.route('/sync', methods=['POST'])
@require_role('chofer', 'admin')
def sync_offline():
    """Batch sync checkins queued while offline.
    Body: { "queue": [ { "entrega_id": int, "estado": str, "latitud": float,
                         "longitud": float, "motivo_incidencia": str,
                         "observacion": str, "hora_local": str } ] }
    Returns per-item result so the client can clear its queue selectively.
    """
    data = request.get_json() or {}
    queue = data.get('queue', [])
    if not isinstance(queue, list):
        return jsonify({'error': 'queue debe ser una lista'}), 400

    user = get_current_user()
    results = []

    for item in queue:
        eid = item.get('entrega_id')
        if not eid:
            results.append({'entrega_id': eid, 'ok': False, 'error': 'entrega_id faltante'})
            continue

        entrega = EntregaDiaria.query.get(eid)
        if not entrega:
            results.append({'entrega_id': eid, 'ok': False, 'error': 'No encontrada'})
            continue
        if user.rol == 'chofer' and entrega.chofer_id != user.id:
            results.append({'entrega_id': eid, 'ok': False, 'error': 'Sin permiso'})
            continue
        if entrega.estado not in ('pendiente', 'parcial'):
            results.append({'entrega_id': eid, 'ok': True, 'skipped': True, 'estado': entrega.estado})
            continue

        estado = item.get('estado', 'entregada')
        entrega.estado = estado
        entrega.motivo_incidencia = item.get('motivo_incidencia')
        entrega.observacion = item.get('observacion')
        lat = item.get('latitud')
        lon = item.get('longitud')
        if lat is not None and lon is not None:
            entrega.latitud_checkin = lat
            entrega.longitud_checkin = lon
            tienda = entrega.pedido.tienda if entrega.pedido else None
            if tienda and tienda.latitud and tienda.longitud:
                entrega.distancia_metros = _haversine(float(lat), float(lon),
                                                      float(tienda.latitud), float(tienda.longitud))
        entrega.hora_registro = datetime.datetime.utcnow()
        entrega.sincronizado_en = datetime.datetime.utcnow()

        pedido = entrega.pedido
        if estado == 'entregada':
            pedido.estado = 'entregado'
        elif estado in ('rechazada', 'local_cerrado'):
            pedido.estado = 'con_incidencia'

        results.append({'entrega_id': eid, 'ok': True})

    db.session.commit()
    return jsonify({'resultados': results})


# ── Devoluciones ───────────────────────────────────────────────────────────────

@bp.route('/<int:id>/devoluciones', methods=['POST'])
@require_role('chofer', 'admin')
def create_devolucion(id):
    entrega = EntregaDiaria.query.get_or_404(id)
    user = get_current_user()
    if user.rol == 'chofer' and entrega.chofer_id != user.id:
        return jsonify({'error': 'Sin permiso'}), 403

    data = request.get_json() or {}
    if not data.get('producto_id'):
        return jsonify({'error': 'producto_id es requerido'}), 400

    motivo = data.get('motivo')
    if motivo and motivo not in MOTIVOS_DEVOLUCION:
        return jsonify({'error': f"motivo debe ser uno de: {', '.join(MOTIVOS_DEVOLUCION)}"}), 400

    Producto.query.get_or_404(data['producto_id'])

    dev = EntregaDevolucion(
        entrega_id=id,
        producto_id=data['producto_id'],
        cantidad_bultos=int(data.get('cantidad_bultos', 0)),
        cantidad_unidades=int(data.get('cantidad_unidades', 0)),
        motivo=motivo,
        reingresa_almacen=bool(data.get('reingresa_almacen', True)),
    )
    db.session.add(dev)

    # If re-entering stock, add a new lote with the returned units
    if dev.reingresa_almacen and (dev.cantidad_bultos > 0 or dev.cantidad_unidades > 0):
        p = Producto.query.get(data['producto_id'])
        upb = p.unidades_por_bulto if p else 1
        # Convert sueltas to bultos (partial bulto stored separately if needed)
        total_uds = (dev.cantidad_bultos * upb) + dev.cantidad_unidades
        bultos_reingreso = total_uds // upb
        if bultos_reingreso > 0:
            lote_retorno = Lote(
                producto_id=data['producto_id'],
                cantidad_bultos=bultos_reingreso,
                nota=f'Devolución entrega #{id}',
                ubicacion_almacen='Retorno — por clasificar',
            )
            db.session.add(lote_retorno)

    # Mark entrega as partial if not already closed
    if entrega.estado == 'pendiente':
        entrega.estado = 'parcial'
        entrega.pedido.estado = 'con_incidencia'

    db.session.commit()
    return jsonify(dev.to_dict()), 201
