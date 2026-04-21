import jwt
import datetime
from functools import wraps
from flask import request, jsonify, current_app


def make_token(user):
    payload = {
        'sub': user.id,
        'rol': user.rol,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24),
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')


def decode_token(token):
    return jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])


def get_current_user():
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None
    try:
        from app.models import Usuario
        payload = decode_token(auth[7:])
        return Usuario.query.get(payload['sub'])
    except Exception:
        return None


def require_role(*roles):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            user = get_current_user()
            if not user or not user.activo:
                return jsonify({'error': 'No autenticado'}), 401
            if roles and user.rol not in roles:
                return jsonify({'error': 'Sin permiso'}), 403
            return f(*args, **kwargs)
        return wrapped
    return decorator
