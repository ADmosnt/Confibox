from flask import Blueprint, jsonify, request
from app import db
from app.models import Producto, GrupoProducto
from app.auth import require_role

bp = Blueprint('productos', __name__)

ROLES_ADMIN = ('admin',)
ROLES_WRITE = ('admin', 'almacenista')
ROLES_READ = ('admin', 'vendedor', 'facturacion', 'almacenista', 'chofer')


@bp.route('', methods=['GET'])
@require_role(*ROLES_READ)
def list_productos():
    q = Producto.query
    search = request.args.get('search', '')
    if search:
        q = q.filter(
            db.or_(
                Producto.descripcion.ilike(f'%{search}%'),
                Producto.codigo.ilike(f'%{search}%'),
            )
        )
    grupo_id = request.args.get('grupo_id')
    if grupo_id:
        q = q.filter(Producto.grupo_id == int(grupo_id))
    activo = request.args.get('activo')
    if activo is not None:
        q = q.filter(Producto.activo == (activo.lower() == 'true'))
    productos = q.order_by(Producto.descripcion).all()
    return jsonify([p.to_dict() for p in productos])


@bp.route('/<int:id>', methods=['GET'])
@require_role(*ROLES_READ)
def get_producto(id):
    p = Producto.query.get_or_404(id)
    return jsonify(p.to_dict())


@bp.route('', methods=['POST'])
@require_role(*ROLES_WRITE)
def create_producto():
    data = request.get_json() or {}
    if not data.get('codigo') or not data.get('descripcion'):
        return jsonify({'error': 'codigo y descripcion son requeridos'}), 400

    if Producto.query.filter_by(codigo=data['codigo']).first():
        return jsonify({'error': 'El código ya existe'}), 409

    p = Producto(
        codigo=data['codigo'],
        descripcion=data['descripcion'],
        unidades_por_bulto=data.get('unidades_por_bulto', 1),
        grupo_id=data.get('grupo_id'),
        activo=data.get('activo', True),
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


@bp.route('/<int:id>', methods=['PUT'])
@require_role(*ROLES_WRITE)
def update_producto(id):
    p = Producto.query.get_or_404(id)
    data = request.get_json() or {}
    for field in ('descripcion', 'unidades_por_bulto', 'grupo_id', 'activo'):
        if field in data:
            setattr(p, field, data[field])
    db.session.commit()
    return jsonify(p.to_dict())


@bp.route('/<int:id>', methods=['DELETE'])
@require_role(*ROLES_ADMIN)
def delete_producto(id):
    from app.models import PedidoDetalle, Pedido
    from sqlalchemy import exists
    p = Producto.query.get_or_404(id)
    activo = db.session.query(
        exists().where(
            PedidoDetalle.producto_id == id
        ).where(
            PedidoDetalle.pedido_id == Pedido.id
        ).where(
            Pedido.estado.in_(['pendiente', 'facturado', 'en_ruta'])
        )
    ).scalar()
    if activo:
        return jsonify({
            'error': 'No se puede desactivar: este producto tiene pedidos activos en curso.'
        }), 409
    p.activo = False
    db.session.commit()
    return '', 204


@bp.route('/<int:id>/reactivar', methods=['POST'])
@require_role(*ROLES_ADMIN)
def reactivar_producto(id):
    p = Producto.query.get_or_404(id)
    p.activo = True
    db.session.commit()
    return jsonify(p.to_dict())
