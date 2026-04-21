from flask import Blueprint, jsonify, request
import datetime
from sqlalchemy import func
from app import db
from app.models import Lote, Producto
from app.auth import require_role

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
    for field in ('numero_lote', 'cantidad_bultos', 'ubicacion_almacen', 'nota'):
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
    """Stock total por producto sumando todos los lotes con bultos > 0."""
    rows = (
        db.session.query(
            Lote.producto_id,
            func.sum(Lote.cantidad_bultos).label('total_bultos'),
        )
        .filter(Lote.cantidad_bultos > 0)
        .group_by(Lote.producto_id)
        .all()
    )
    result = []
    for r in rows:
        p = Producto.query.get(r.producto_id)
        if not p:
            continue
        result.append({
            'producto_id': r.producto_id,
            'codigo': p.codigo,
            'descripcion': p.descripcion,
            'unidades_por_bulto': p.unidades_por_bulto,
            'total_bultos': int(r.total_bultos),
            'total_unidades': int(r.total_bultos) * p.unidades_por_bulto,
        })
    result.sort(key=lambda x: x['descripcion'])
    return jsonify(result)
