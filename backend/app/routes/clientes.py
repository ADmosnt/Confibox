from flask import Blueprint, jsonify, request
from app import db
from app.models import Cliente, Usuario
from app.auth import require_role

bp = Blueprint('clientes', __name__)

ROLES_ADMIN = ('admin',)
ROLES_WRITE = ('admin', 'vendedor')
ROLES_READ = ('admin', 'vendedor', 'facturacion', 'almacenista', 'chofer')


@bp.route('', methods=['GET'])
@require_role(*ROLES_READ)
def list_clientes():
    q = Cliente.query
    search = request.args.get('search', '')
    if search:
        q = q.filter(
            db.or_(
                Cliente.razon_social.ilike(f'%{search}%'),
                Cliente.codigo.ilike(f'%{search}%'),
                Cliente.rif.ilike(f'%{search}%'),
            )
        )
    zona_id = request.args.get('zona_id')
    if zona_id:
        q = q.filter(Cliente.zona_id == int(zona_id))
    empresa = request.args.get('empresa')
    if empresa:
        q = q.filter(Cliente.empresa == empresa)
    activo = request.args.get('activo')
    if activo is not None:
        q = q.filter(Cliente.activo == (activo.lower() == 'true'))
    clientes = q.order_by(Cliente.razon_social).all()
    return jsonify([c.to_dict() for c in clientes])


@bp.route('/<int:id>', methods=['GET'])
@require_role(*ROLES_READ)
def get_cliente(id):
    c = Cliente.query.get_or_404(id)
    return jsonify(c.to_dict())


@bp.route('', methods=['POST'])
@require_role(*ROLES_WRITE)
def create_cliente():
    data = request.get_json() or {}
    if not data.get('codigo') or not data.get('razon_social'):
        return jsonify({'error': 'codigo y razon_social son requeridos'}), 400

    if Cliente.query.filter_by(codigo=data['codigo']).first():
        return jsonify({'error': 'El código ya existe'}), 409

    empresa = data.get('empresa', 'confibox')
    if empresa not in ('confibox', 'actual', 'ambos'):
        return jsonify({'error': "empresa debe ser 'confibox', 'actual' o 'ambos'"}), 400

    c = Cliente(
        codigo=data['codigo'],
        razon_social=data['razon_social'],
        rif=data.get('rif'),
        direccion=data.get('direccion'),
        zona_id=data.get('zona_id'),
        vendedor_id=data.get('vendedor_id'),
        empresa=empresa,
        telefono=data.get('telefono'),
        latitud=data.get('latitud'),
        longitud=data.get('longitud'),
        foto_url=data.get('foto_url'),
        observaciones=data.get('observaciones'),
        activo=data.get('activo', True),
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@bp.route('/<int:id>', methods=['PUT'])
@require_role(*ROLES_WRITE)
def update_cliente(id):
    c = Cliente.query.get_or_404(id)
    data = request.get_json() or {}

    if 'empresa' in data and data['empresa'] not in ('confibox', 'actual', 'ambos'):
        return jsonify({'error': "empresa debe ser 'confibox', 'actual' o 'ambos'"}), 400

    for field in ('razon_social', 'rif', 'direccion', 'zona_id', 'vendedor_id',
                  'empresa', 'telefono', 'latitud', 'longitud', 'foto_url',
                  'observaciones', 'activo'):
        if field in data:
            setattr(c, field, data[field])

    db.session.commit()
    return jsonify(c.to_dict())


@bp.route('/<int:id>/reactivar', methods=['POST'])
@require_role(*ROLES_ADMIN)
def reactivar_cliente(id):
    c = Cliente.query.get_or_404(id)
    c.activo = True
    db.session.commit()
    return jsonify(c.to_dict())


@bp.route('/<int:id>', methods=['DELETE'])
@require_role(*ROLES_ADMIN)
def delete_cliente(id):
    from app.models import Pedido
    c = Cliente.query.get_or_404(id)
    activos = Pedido.query.filter(
        Pedido.tienda_id == id,
        Pedido.estado.in_(['pendiente', 'facturado', 'en_ruta'])
    ).count()
    if activos:
        return jsonify({
            'error': f'No se puede desactivar: esta tienda tiene {activos} pedido(s) activo(s).'
        }), 409
    c.activo = False
    db.session.commit()
    return '', 204
