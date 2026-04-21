from flask import Blueprint, jsonify, request
from app import db
from app.models import Zona, GrupoProducto, Cliente, Producto
from app.auth import require_role

bp = Blueprint('maestras', __name__)

ROLES_ADMIN = ('admin',)
ROLES_STAFF = ('admin', 'vendedor', 'facturacion', 'almacenista', 'chofer')


# ── Zonas ─────────────────────────────────────────────────────────────────────

@bp.route('/zonas', methods=['GET'])
@require_role(*ROLES_STAFF)
def get_zonas():
    zonas = Zona.query.order_by(Zona.nombre).all()
    return jsonify([z.to_dict() for z in zonas])


@bp.route('/zonas', methods=['POST'])
@require_role(*ROLES_ADMIN)
def create_zona():
    data = request.get_json() or {}
    if not data.get('nombre'):
        return jsonify({'error': 'nombre requerido'}), 400
    z = Zona(nombre=data['nombre'], color=data.get('color'))
    db.session.add(z)
    db.session.commit()
    return jsonify(z.to_dict()), 201


@bp.route('/zonas/<int:id>', methods=['PUT'])
@require_role(*ROLES_ADMIN)
def update_zona(id):
    z = Zona.query.get_or_404(id)
    data = request.get_json() or {}
    if 'nombre' in data:
        z.nombre = data['nombre']
    if 'color' in data:
        z.color = data['color']
    db.session.commit()
    return jsonify(z.to_dict())


@bp.route('/zonas/<int:id>', methods=['DELETE'])
@require_role(*ROLES_ADMIN)
def delete_zona(id):
    z = Zona.query.get_or_404(id)
    n = Cliente.query.filter_by(zona_id=id).count()
    if n:
        return jsonify({'error': f'No se puede eliminar: {n} tienda(s) pertenecen a esta zona.'}), 409
    db.session.delete(z)
    db.session.commit()
    return '', 204


# ── Grupos de Productos ────────────────────────────────────────────────────────

@bp.route('/grupos-productos', methods=['GET'])
@require_role(*ROLES_STAFF)
def get_grupos_productos():
    grupos = GrupoProducto.query.order_by(GrupoProducto.nombre).all()
    return jsonify([g.to_dict() for g in grupos])


@bp.route('/grupos-productos', methods=['POST'])
@require_role(*ROLES_ADMIN)
def create_grupo_producto():
    data = request.get_json() or {}
    if not data.get('nombre'):
        return jsonify({'error': 'nombre requerido'}), 400
    g = GrupoProducto(nombre=data['nombre'])
    db.session.add(g)
    db.session.commit()
    return jsonify(g.to_dict()), 201


@bp.route('/grupos-productos/<int:id>', methods=['PUT'])
@require_role(*ROLES_ADMIN)
def update_grupo_producto(id):
    g = GrupoProducto.query.get_or_404(id)
    data = request.get_json() or {}
    if 'nombre' in data:
        g.nombre = data['nombre']
    db.session.commit()
    return jsonify(g.to_dict())


@bp.route('/grupos-productos/<int:id>', methods=['DELETE'])
@require_role(*ROLES_ADMIN)
def delete_grupo_producto(id):
    g = GrupoProducto.query.get_or_404(id)
    n = Producto.query.filter_by(grupo_id=id, activo=True).count()
    if n:
        return jsonify({'error': f'No se puede eliminar: {n} producto(s) pertenecen a este grupo.'}), 409
    db.session.delete(g)
    db.session.commit()
    return '', 204
