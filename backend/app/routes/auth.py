import secrets
import datetime
from flask import Blueprint, jsonify, request
from app.models import Usuario, RecoveryCode
from app.auth import make_token, get_current_user, require_role
from app import db, limiter

bp = Blueprint('auth', __name__)

_NUM_RECOVERY_CODES = 8


@bp.route('/login', methods=['POST'])
@limiter.limit('10 per minute; 50 per hour')
def login():
    data = request.get_json() or {}
    user = Usuario.query.filter_by(username=data.get('username'), activo=True).first()
    if not user or not user.check_password(data.get('password', '')):
        return jsonify({'error': 'Credenciales incorrectas'}), 401
    return jsonify({'token': make_token(user), 'user': user.to_dict()})


@bp.route('/me', methods=['GET'])
def me():
    user = get_current_user()
    if not user or not user.activo:
        return jsonify({'error': 'No autenticado'}), 401
    return jsonify(user.to_dict())


@bp.route('/change-password', methods=['PUT'])
def change_password():
    user = get_current_user()
    if not user or not user.activo:
        return jsonify({'error': 'No autenticado'}), 401
    data = request.get_json() or {}
    current = data.get('current_password', '')
    new_pw = data.get('new_password', '')
    if not user.check_password(current):
        return jsonify({'error': 'La contraseña actual es incorrecta'}), 400
    if len(new_pw) < 6:
        return jsonify({'error': 'La nueva contraseña debe tener al menos 6 caracteres'}), 400
    user.set_password(new_pw)
    db.session.commit()
    return jsonify({'ok': True})


@bp.route('/generate-recovery-codes', methods=['POST'])
def generate_recovery_codes():
    user = get_current_user()
    if not user or not user.activo:
        return jsonify({'error': 'No autenticado'}), 401

    # Delete all existing codes for this user
    RecoveryCode.query.filter_by(usuario_id=user.id).delete()

    plain_codes = [secrets.token_urlsafe(12) for _ in range(_NUM_RECOVERY_CODES)]
    for code in plain_codes:
        from werkzeug.security import generate_password_hash
        rc = RecoveryCode(usuario_id=user.id, code_hash=generate_password_hash(code))
        db.session.add(rc)
    db.session.commit()

    return jsonify({'codes': plain_codes})


@bp.route('/recovery-codes/count', methods=['GET'])
def recovery_codes_count():
    user = get_current_user()
    if not user or not user.activo:
        return jsonify({'error': 'No autenticado'}), 401
    n = RecoveryCode.query.filter_by(usuario_id=user.id, usado_en=None).count()
    return jsonify({'active': n})


@bp.route('/recover', methods=['POST'])
@limiter.limit('5 per minute; 20 per hour')
def recover():
    data = request.get_json() or {}
    username = data.get('username', '')
    code_plain = data.get('recovery_code', '')
    if not username or not code_plain:
        return jsonify({'error': 'username y recovery_code son requeridos'}), 400

    user = Usuario.query.filter_by(username=username, activo=True).first()
    if not user:
        return jsonify({'error': 'Código inválido o usuario no encontrado'}), 401

    from werkzeug.security import check_password_hash
    unused = RecoveryCode.query.filter_by(usuario_id=user.id, usado_en=None).all()
    matched = next((rc for rc in unused if check_password_hash(rc.code_hash, code_plain)), None)
    if not matched:
        return jsonify({'error': 'Código inválido o ya utilizado'}), 401

    matched.usado_en = datetime.datetime.utcnow()
    db.session.commit()
    return jsonify({'token': make_token(user), 'user': user.to_dict()})
