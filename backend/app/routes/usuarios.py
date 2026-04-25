from flask import Blueprint, jsonify, request
from app import db
from app.models import Usuario
from app.auth import require_role

bp = Blueprint('usuarios', __name__)

ROLES_VALIDOS = ('admin', 'vendedor', 'facturacion', 'almacenista', 'chofer')


@bp.route('', methods=['GET'])
@require_role('admin')
def list_usuarios():
    usuarios = Usuario.query.order_by(Usuario.username).all()
    return jsonify([u.to_dict() for u in usuarios])


@bp.route('/by-rol', methods=['GET'])
@require_role('admin', 'vendedor', 'almacenista')
def list_by_rol():
    """Lite list of active users filtered by rol — used by forms (chofer/vendedor selectors)."""
    rol = request.args.get('rol')
    if rol not in ROLES_VALIDOS:
        return jsonify({'error': f"rol debe ser uno de: {', '.join(ROLES_VALIDOS)}"}), 400
    usuarios = Usuario.query.filter_by(rol=rol, activo=True).order_by(Usuario.username).all()
    return jsonify([{'id': u.id, 'username': u.username} for u in usuarios])


@bp.route('', methods=['POST'])
@require_role('admin')
def create_usuario():
    data = request.get_json() or {}
    if not data.get('username') or not data.get('password'):
        return jsonify({'error': 'username y password son requeridos'}), 400
    if Usuario.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'El nombre de usuario ya existe'}), 400
    rol = data.get('rol', 'chofer')
    if rol not in ROLES_VALIDOS:
        return jsonify({'error': f"rol debe ser uno de: {', '.join(ROLES_VALIDOS)}"}), 400
    u = Usuario(username=data['username'], rol=rol)
    u.set_password(data['password'])
    db.session.add(u)
    db.session.commit()
    return jsonify(u.to_dict()), 201


@bp.route('/<int:id>', methods=['PUT'])
@require_role('admin')
def update_usuario(id):
    u = Usuario.query.get_or_404(id)
    data = request.get_json() or {}
    if 'password' in data and data['password']:
        u.set_password(data['password'])
    if 'activo' in data:
        u.activo = bool(data['activo'])
    if 'rol' in data:
        if data['rol'] not in ROLES_VALIDOS:
            return jsonify({'error': f"rol debe ser uno de: {', '.join(ROLES_VALIDOS)}"}), 400
        u.rol = data['rol']
    db.session.commit()
    return jsonify(u.to_dict())


@bp.route('/<int:id>', methods=['DELETE'])
@require_role('admin')
def delete_usuario(id):
    u = Usuario.query.get_or_404(id)
    u.activo = False
    db.session.commit()
    return jsonify({'ok': True})
