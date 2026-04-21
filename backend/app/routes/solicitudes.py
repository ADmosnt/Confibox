import datetime
from flask import Blueprint, jsonify, request
from app import db
from app.models import SolicitudGeoref, Cliente
from app.auth import require_role, get_current_user

bp = Blueprint('solicitudes', __name__)


@bp.route('', methods=['GET'])
@require_role('admin')
def list_solicitudes():
    q = SolicitudGeoref.query
    estado = request.args.get('estado')
    if estado:
        q = q.filter(SolicitudGeoref.estado == estado)
    tienda_id = request.args.get('tienda_id')
    if tienda_id:
        q = q.filter(SolicitudGeoref.tienda_id == int(tienda_id))
    solicitudes = q.order_by(SolicitudGeoref.creado_en.desc()).all()
    return jsonify([s.to_dict() for s in solicitudes])


@bp.route('/<int:id>', methods=['GET'])
@require_role('admin', 'chofer')
def get_solicitud(id):
    s = SolicitudGeoref.query.get_or_404(id)
    return jsonify(s.to_dict())


@bp.route('', methods=['POST'])
@require_role('chofer', 'admin', 'vendedor')
def create_solicitud():
    data = request.get_json() or {}
    if not data.get('tienda_id'):
        return jsonify({'error': 'tienda_id es requerido'}), 400
    if data.get('latitud_sugerida') is None or data.get('longitud_sugerida') is None:
        return jsonify({'error': 'latitud_sugerida y longitud_sugerida son requeridos'}), 400

    tienda = Cliente.query.get_or_404(data['tienda_id'])
    user = get_current_user()

    # Block if there's already a pending request for this store
    existente = SolicitudGeoref.query.filter_by(
        tienda_id=data['tienda_id'], estado='pendiente'
    ).first()
    if existente:
        return jsonify({'error': 'Ya existe una solicitud pendiente para esta tienda'}), 409

    s = SolicitudGeoref(
        tienda_id=data['tienda_id'],
        chofer_id=user.id,
        latitud_actual=float(tienda.latitud) if tienda.latitud else None,
        longitud_actual=float(tienda.longitud) if tienda.longitud else None,
        latitud_sugerida=float(data['latitud_sugerida']),
        longitud_sugerida=float(data['longitud_sugerida']),
        motivo=data.get('motivo'),
    )
    db.session.add(s)
    db.session.commit()
    return jsonify(s.to_dict()), 201


@bp.route('/<int:id>/aprobar', methods=['PUT'])
@require_role('admin')
def aprobar_solicitud(id):
    s = SolicitudGeoref.query.get_or_404(id)
    if s.estado != 'pendiente':
        return jsonify({'error': f'La solicitud ya fue procesada (estado: {s.estado})'}), 409

    user = get_current_user()
    tienda = Cliente.query.get(s.tienda_id)
    if tienda:
        tienda.latitud = s.latitud_sugerida
        tienda.longitud = s.longitud_sugerida

    s.estado = 'aprobada'
    s.revisado_por = user.id
    s.revisado_en = datetime.datetime.utcnow()
    db.session.commit()
    return jsonify(s.to_dict())


@bp.route('/<int:id>/rechazar', methods=['PUT'])
@require_role('admin')
def rechazar_solicitud(id):
    s = SolicitudGeoref.query.get_or_404(id)
    if s.estado != 'pendiente':
        return jsonify({'error': f'La solicitud ya fue procesada (estado: {s.estado})'}), 409

    user = get_current_user()
    s.estado = 'rechazada'
    s.revisado_por = user.id
    s.revisado_en = datetime.datetime.utcnow()
    db.session.commit()
    return jsonify(s.to_dict())
