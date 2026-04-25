import os
import uuid
from flask import Blueprint, jsonify, request, send_from_directory
from app.auth import require_role

bp = Blueprint('uploads', __name__)

ALLOWED = {'jpg', 'jpeg', 'png', 'webp', 'heic', 'avif'}
MAX_BYTES = 10 * 1024 * 1024  # 10 MB


def _upload_dir():
    d = os.environ.get('UPLOAD_DIR', '/data/uploads')
    os.makedirs(d, exist_ok=True)
    return d


@bp.route('', methods=['POST'])
@require_role('admin', 'vendedor', 'almacenista', 'chofer')
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'Campo file requerido'}), 400
    f = request.files['file']
    if not f.filename:
        return jsonify({'error': 'Nombre de archivo vacío'}), 400

    ext = f.filename.rsplit('.', 1)[-1].lower() if '.' in f.filename else ''
    if ext not in ALLOWED:
        return jsonify({'error': f'Tipo no permitido. Usa: {", ".join(sorted(ALLOWED))}'}), 400

    content = f.read()
    if len(content) > MAX_BYTES:
        return jsonify({'error': 'Archivo demasiado grande (máx. 10 MB)'}), 413

    filename = f'{uuid.uuid4().hex}.{ext}'
    path = os.path.join(_upload_dir(), filename)
    with open(path, 'wb') as fh:
        fh.write(content)

    return jsonify({'url': f'/api/uploads/{filename}'}), 201


@bp.route('/<filename>', methods=['GET'])
def serve(filename):
    if '/' in filename or '..' in filename:
        return jsonify({'error': 'Ruta inválida'}), 400
    return send_from_directory(_upload_dir(), filename)
