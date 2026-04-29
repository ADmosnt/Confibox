from flask import Blueprint, jsonify, request
import datetime
from sqlalchemy import func
from app import db
from app.models import Lote, Producto, AlmacenZona, Ubicacion, Etiqueta, MovimientoLote
from app.auth import require_role, get_current_user

bp = Blueprint('inventario', __name__)

ROLES_READ = ('admin', 'almacenista', 'chofer')
ROLES_WRITE = ('admin', 'almacenista')


@bp.route('/lotes', methods=['GET'])
@require_role(*ROLES_READ)
def list_lotes():
    q = Lote.query
    producto_id = request.args.get('producto_id')
    if producto_id:
        q = q.filter(Lote.producto_id == int(producto_id))
    por_vencer = request.args.get('por_vencer')
    if por_vencer:
        dias = int(por_vencer)
        limite = datetime.date.today() + datetime.timedelta(days=dias)
        q = q.filter(
            Lote.fecha_vencimiento != None,
            Lote.fecha_vencimiento <= limite,
            Lote.cantidad_bultos > 0,
        )
    if request.args.get('con_stock', '').lower() == 'true':
        q = q.filter(Lote.cantidad_bultos > 0)
    lotes = q.order_by(Lote.fecha_vencimiento.asc().nullslast(), Lote.fecha_ingreso).all()
    return jsonify([l.to_dict() for l in lotes])


@bp.route('/lotes', methods=['POST'])
@require_role(*ROLES_WRITE)
def create_lote():
    data = request.get_json() or {}
    if not data.get('producto_id') or data.get('cantidad_bultos') is None:
        return jsonify({'error': 'producto_id y cantidad_bultos son requeridos'}), 400
    Producto.query.get_or_404(data['producto_id'])

    fecha_venc = None
    if data.get('fecha_vencimiento'):
        try:
            fecha_venc = datetime.date.fromisoformat(data['fecha_vencimiento'])
        except ValueError:
            return jsonify({'error': 'fecha_vencimiento inválida (formato: YYYY-MM-DD)'}), 400

    lote = Lote(
        producto_id=data['producto_id'],
        numero_lote=data.get('numero_lote'),
        cantidad_bultos=int(data['cantidad_bultos']),
        fecha_vencimiento=fecha_venc,
        ubicacion_almacen=data.get('ubicacion_almacen'),
        nota=data.get('nota'),
    )
    db.session.add(lote)
    db.session.commit()
    return jsonify(lote.to_dict()), 201


@bp.route('/lotes/<int:id>', methods=['PUT'])
@require_role(*ROLES_WRITE)
def update_lote(id):
    lote = Lote.query.get_or_404(id)
    data = request.get_json() or {}
    for field in ('numero_lote', 'cantidad_bultos', 'ubicacion_almacen', 'ubicacion_id', 'nivel', 'nota'):
        if field in data:
            setattr(lote, field, data[field])
    if 'fecha_vencimiento' in data:
        if data['fecha_vencimiento']:
            try:
                lote.fecha_vencimiento = datetime.date.fromisoformat(data['fecha_vencimiento'])
            except ValueError:
                return jsonify({'error': 'fecha_vencimiento inválida'}), 400
        else:
            lote.fecha_vencimiento = None
    db.session.commit()
    return jsonify(lote.to_dict())


@bp.route('/stock', methods=['GET'])
@require_role(*ROLES_READ)
def get_stock_consolidado():
    """Stock total por producto. Single JOIN — no N+1."""
    rows = (
        db.session.query(Producto, func.sum(Lote.cantidad_bultos).label('total'))
        .join(Lote, Lote.producto_id == Producto.id)
        .filter(Lote.cantidad_bultos > 0)
        .group_by(Producto.id)
        .order_by(Producto.descripcion)
        .all()
    )
    return jsonify([
        {
            'producto_id': p.id,
            'codigo': p.codigo,
            'descripcion': p.descripcion,
            'unidades_por_bulto': p.unidades_por_bulto,
            'total_bultos': int(total),
            'total_unidades': int(total) * p.unidades_por_bulto,
        }
        for p, total in rows
    ])


# ── WMS Planner: Zonas (logical map regions) ───────────────────────────────────

@bp.route('/almacen-zonas', methods=['GET'])
@require_role(*ROLES_READ)
def list_almacen_zonas():
    return jsonify([z.to_dict() for z in AlmacenZona.query.order_by(AlmacenZona.nombre).all()])


@bp.route('/almacen-zonas', methods=['POST'])
@require_role(*ROLES_WRITE)
def create_almacen_zona():
    data = request.get_json() or {}
    if not data.get('nombre'):
        return jsonify({'error': 'nombre requerido'}), 400
    if AlmacenZona.query.filter_by(nombre=data['nombre']).first():
        return jsonify({'error': 'Ya existe una zona con ese nombre'}), 409
    z = AlmacenZona(
        nombre=data['nombre'],
        color=data.get('color', '#DBEAFE'),
        x=int(data.get('x', 0)), y=int(data.get('y', 0)),
        width=int(data.get('width', 200)), height=int(data.get('height', 150)),
    )
    db.session.add(z)
    db.session.commit()
    return jsonify(z.to_dict()), 201


@bp.route('/almacen-zonas/<int:id>', methods=['PUT'])
@require_role(*ROLES_WRITE)
def update_almacen_zona(id):
    z = AlmacenZona.query.get_or_404(id)
    data = request.get_json() or {}
    for field in ('nombre', 'color', 'x', 'y', 'width', 'height'):
        if field in data:
            setattr(z, field, data[field])
    db.session.commit()
    return jsonify(z.to_dict())


@bp.route('/almacen-zonas/<int:id>', methods=['DELETE'])
@require_role(*ROLES_WRITE)
def delete_almacen_zona(id):
    z = AlmacenZona.query.get_or_404(id)
    n = Ubicacion.query.filter_by(zona_id=id).count()
    if n:
        return jsonify({'error': f'No se puede eliminar: {n} ubicación(es) pertenecen a esta zona.'}), 409
    db.session.delete(z)
    db.session.commit()
    return '', 204


# ── WMS Planner: Ubicaciones (physical addressable spots) ──────────────────────

@bp.route('/ubicaciones', methods=['GET'])
@require_role(*ROLES_READ)
def list_ubicaciones():
    placed = request.args.get('placed')
    q = Ubicacion.query
    if placed == 'true':
        q = q.filter(Ubicacion.x.isnot(None))
    elif placed == 'false':
        q = q.filter(Ubicacion.x.is_(None))
    return jsonify([u.to_dict() for u in q.order_by(Ubicacion.codigo).all()])


@bp.route('/ubicaciones', methods=['POST'])
@require_role(*ROLES_WRITE)
def create_ubicacion():
    data = request.get_json() or {}
    if not data.get('codigo'):
        return jsonify({'error': 'codigo requerido'}), 400
    tipo = data.get('tipo', 'piso')
    if tipo not in ('piso', 'rack', 'suelo'):
        return jsonify({'error': "tipo debe ser 'piso', 'rack' o 'suelo'"}), 400
    niveles = int(data.get('niveles', 1))
    if niveles < 1:
        return jsonify({'error': 'niveles debe ser >= 1'}), 400
    if tipo in ('piso', 'suelo'):
        niveles = 1  # floor types are single-level
    if Ubicacion.query.filter_by(codigo=data['codigo']).first():
        return jsonify({'error': 'Ya existe una ubicación con ese código'}), 409
    u = Ubicacion(
        codigo=data['codigo'],
        zona_id=data.get('zona_id'),
        tipo=tipo,
        niveles=niveles,
        x=data.get('x'), y=data.get('y'),
        width=int(data.get('width', 80)),
        height=int(data.get('height', 60 if tipo == 'piso' else 100)),
        rotacion=int(data.get('rotacion', 0)),
        capacidad_max_bultos=data.get('capacidad_max_bultos'),
    )
    db.session.add(u)
    db.session.commit()
    return jsonify(u.to_dict()), 201


@bp.route('/ubicaciones/<int:id>', methods=['PUT'])
@require_role(*ROLES_WRITE)
def update_ubicacion(id):
    u = Ubicacion.query.get_or_404(id)
    data = request.get_json() or {}
    if 'tipo' in data and data['tipo'] not in ('piso', 'rack', 'suelo'):
        return jsonify({'error': "tipo debe ser 'piso', 'rack' o 'suelo'"}), 400
    # Block reducing niveles below the highest occupied nivel
    if 'niveles' in data:
        new_niveles = int(data['niveles'])
        max_in_use = (
            db.session.query(func.max(Lote.nivel))
            .filter(Lote.ubicacion_id == id, Lote.cantidad_bultos > 0)
            .scalar()
        )
        if max_in_use and new_niveles < max_in_use:
            return jsonify({
                'error': f'No se puede reducir a {new_niveles} niveles: hay stock en el nivel {max_in_use}.'
            }), 409
    for field in ('codigo', 'zona_id', 'tipo', 'niveles', 'x', 'y', 'width', 'height', 'rotacion', 'capacidad_max_bultos'):
        if field in data:
            setattr(u, field, data[field])
    db.session.commit()
    return jsonify(u.to_dict())


@bp.route('/ubicaciones/<int:id>', methods=['DELETE'])
@require_role(*ROLES_WRITE)
def delete_ubicacion(id):
    u = Ubicacion.query.get_or_404(id)
    n = Lote.query.filter_by(ubicacion_id=id).filter(Lote.cantidad_bultos > 0).count()
    if n:
        return jsonify({'error': f'No se puede eliminar: {n} lote(s) con stock asignados aquí.'}), 409
    # Detach any zero-stock lotes that pointed here, then delete
    Lote.query.filter_by(ubicacion_id=id).update({'ubicacion_id': None, 'nivel': None})
    db.session.delete(u)
    db.session.commit()
    return '', 204


@bp.route('/lotes/<int:id>/ubicar', methods=['PUT'])
@require_role(*ROLES_WRITE)
def ubicar_lote(id):
    """Assign a lote to (ubicacion, nivel). Validates nivel range + capacity.
    Logs every move to MovimientoLote inside an atomic SAVEPOINT so the lote
    update and audit row commit together or not at all."""
    lote = Lote.query.get_or_404(id)
    data = request.get_json() or {}
    user = get_current_user()
    orig_ubic_id, orig_nivel = lote.ubicacion_id, lote.nivel
    ubicacion_id = data.get('ubicacion_id')

    # Detach (no destination)
    if ubicacion_id is None:
        if orig_ubic_id is None:
            return jsonify(lote.to_dict())  # nothing to do
        try:
            with db.session.begin_nested():
                lote.ubicacion_id = None
                lote.nivel = None
                db.session.add(MovimientoLote(
                    lote_id=id,
                    ubicacion_origen_id=orig_ubic_id, nivel_origen=orig_nivel,
                    ubicacion_destino_id=None, nivel_destino=None,
                    usuario_id=user.id if user else None, accion='retirar',
                ))
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise
        return jsonify(lote.to_dict())

    u = Ubicacion.query.get_or_404(ubicacion_id)
    nivel = data.get('nivel')
    if u.tipo == 'rack':
        if nivel is None:
            return jsonify({'error': 'nivel requerido para racks'}), 400
        nivel = int(nivel)
        if nivel < 1 or nivel > u.niveles:
            return jsonify({'error': f'nivel fuera de rango (1..{u.niveles})'}), 400
    else:
        nivel = None

    # Capacity check (per-slot for racks, per-ubicacion for piso/suelo)
    if u.capacidad_max_bultos is not None:
        nivel_filter = (Lote.nivel == nivel) if nivel is not None else (Lote.nivel.is_(None))
        existing_total = (
            db.session.query(func.sum(Lote.cantidad_bultos))
            .filter(
                Lote.ubicacion_id == u.id,
                nivel_filter,
                Lote.id != lote.id,
                Lote.cantidad_bultos > 0,
            )
            .scalar() or 0
        )
        if existing_total + lote.cantidad_bultos > u.capacidad_max_bultos:
            return jsonify({
                'error': (
                    f'Capacidad excedida en {u.codigo}'
                    + (f' N{nivel}' if nivel else '')
                    + f': {existing_total + lote.cantidad_bultos}/{u.capacidad_max_bultos} bultos'
                )
            }), 409

    accion = 'mover' if orig_ubic_id else 'ubicar'
    try:
        with db.session.begin_nested():
            lote.ubicacion_id = u.id
            lote.nivel = nivel
            db.session.add(MovimientoLote(
                lote_id=id,
                ubicacion_origen_id=orig_ubic_id, nivel_origen=orig_nivel,
                ubicacion_destino_id=u.id, nivel_destino=nivel,
                usuario_id=user.id if user else None, accion=accion,
            ))
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return jsonify(lote.to_dict())


@bp.route('/lotes/<int:id>/estado', methods=['PUT'])
@require_role(*ROLES_WRITE)
def cambiar_estado_lote(id):
    """Change a lote's estado (disponible/bloqueado/cuarentena/reservado)."""
    lote = Lote.query.get_or_404(id)
    data = request.get_json() or {}
    nuevo = data.get('estado')
    if nuevo not in ('disponible', 'bloqueado', 'cuarentena', 'reservado'):
        return jsonify({'error': 'estado inválido'}), 400
    if nuevo == lote.estado:
        return jsonify(lote.to_dict())
    user = get_current_user()
    anterior = lote.estado
    try:
        with db.session.begin_nested():
            lote.estado = nuevo
            db.session.add(MovimientoLote(
                lote_id=id,
                ubicacion_origen_id=lote.ubicacion_id, nivel_origen=lote.nivel,
                ubicacion_destino_id=lote.ubicacion_id, nivel_destino=lote.nivel,
                usuario_id=user.id if user else None,
                accion='cambio_estado',
                detalle=f'estado: {anterior} → {nuevo}',
            ))
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return jsonify(lote.to_dict())


@bp.route('/movimientos-lote', methods=['GET'])
@require_role(*ROLES_READ)
def list_movimientos():
    """Audit log: most recent movements first (limited)."""
    limit = min(int(request.args.get('limit', 100)), 500)
    lote_id = request.args.get('lote_id')
    q = MovimientoLote.query
    if lote_id:
        q = q.filter(MovimientoLote.lote_id == int(lote_id))
    movs = q.order_by(MovimientoLote.creado_en.desc()).limit(limit).all()
    return jsonify([m.to_dict() for m in movs])


@bp.route('/almacen-stock', methods=['GET'])
@require_role(*ROLES_READ)
def almacen_stock():
    """Lotes with stock > 0 indexed by ubicacion_id and nivel.
    Returns a flat dict: '{ubicacion_id}:{nivel|0}' → list of lotes."""
    lotes = Lote.query.filter(Lote.cantidad_bultos > 0).all()
    by_slot = {}
    unassigned = []
    for lote in lotes:
        if lote.ubicacion_id is None:
            unassigned.append(lote.to_dict())
            continue
        key = f"{lote.ubicacion_id}:{lote.nivel or 0}"
        by_slot.setdefault(key, []).append(lote.to_dict())
    return jsonify({'slots': by_slot, 'sin_ubicar': unassigned})


# ── Etiquetas (reusable labels assignable to ubicaciones) ──────────────────────

@bp.route('/etiquetas', methods=['GET'])
@require_role(*ROLES_READ)
def list_etiquetas():
    return jsonify([e.to_dict() for e in Etiqueta.query.order_by(Etiqueta.nombre).all()])


@bp.route('/etiquetas', methods=['POST'])
@require_role(*ROLES_WRITE)
def create_etiqueta():
    data = request.get_json() or {}
    if not data.get('nombre'):
        return jsonify({'error': 'nombre requerido'}), 400
    if Etiqueta.query.filter_by(nombre=data['nombre'].strip()).first():
        return jsonify({'error': 'Ya existe una etiqueta con ese nombre'}), 409
    e = Etiqueta(nombre=data['nombre'].strip(), color=data.get('color', '#E2E8F0'))
    db.session.add(e)
    db.session.commit()
    return jsonify(e.to_dict()), 201


@bp.route('/etiquetas/<int:id>', methods=['DELETE'])
@require_role(*ROLES_WRITE)
def delete_etiqueta(id):
    e = Etiqueta.query.get_or_404(id)
    db.session.delete(e)
    db.session.commit()
    return '', 204


@bp.route('/ubicaciones/<int:id>/etiquetas', methods=['POST'])
@require_role(*ROLES_WRITE)
def assign_etiqueta(id):
    u = Ubicacion.query.get_or_404(id)
    etiqueta_id = (request.get_json() or {}).get('etiqueta_id')
    if not etiqueta_id:
        return jsonify({'error': 'etiqueta_id requerido'}), 400
    e = Etiqueta.query.get_or_404(etiqueta_id)
    if e not in u.etiquetas_asignadas:
        u.etiquetas_asignadas.append(e)
        db.session.commit()
    return jsonify(u.to_dict())


@bp.route('/ubicaciones/<int:id>/etiquetas/<int:eid>', methods=['DELETE'])
@require_role(*ROLES_WRITE)
def unassign_etiqueta(id, eid):
    u = Ubicacion.query.get_or_404(id)
    e = Etiqueta.query.get(eid)
    if e and e in u.etiquetas_asignadas:
        u.etiquetas_asignadas.remove(e)
        db.session.commit()
    return jsonify(u.to_dict())
