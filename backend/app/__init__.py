from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import os

db = SQLAlchemy()
migrate = Migrate()
limiter = Limiter(key_func=get_remote_address, default_limits=[])

REACT_BUILD = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'react_build')


def create_app():
    app = Flask(__name__)

    db_url = os.environ.get('DATABASE_URL', 'postgresql://appuser:dev@localhost:5432/consignacion')
    if db_url.startswith('postgres://'):
        db_url = db_url.replace('postgres://', 'postgresql://', 1)

    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')

    db.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    @app.after_request
    def _security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        # Allow geolocation for field workers
        response.headers['Permissions-Policy'] = 'geolocation=(self), microphone=(), camera=()'
        return response

    from app import models  # noqa: F401

    from app.routes.config import bp as config_bp
    from app.routes.maestras import bp as maestras_bp
    from app.routes.clientes import bp as clientes_bp
    from app.routes.productos import bp as productos_bp
    from app.routes.dashboard import bp as dashboard_bp
    from app.routes.inventario import bp as inventario_bp
    from app.routes.auth import bp as auth_bp
    from app.routes.usuarios import bp as usuarios_bp
    from app.routes.pedidos import bp as pedidos_bp
    from app.routes.entregas import bp as entregas_bp
    from app.routes.solicitudes import bp as solicitudes_bp

    app.register_blueprint(config_bp, url_prefix='/api/config')
    app.register_blueprint(maestras_bp, url_prefix='/api')
    app.register_blueprint(clientes_bp, url_prefix='/api/clientes')
    app.register_blueprint(productos_bp, url_prefix='/api/productos')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(inventario_bp, url_prefix='/api/inventario')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(usuarios_bp, url_prefix='/api/usuarios')
    app.register_blueprint(pedidos_bp, url_prefix='/api/pedidos')
    app.register_blueprint(entregas_bp, url_prefix='/api/entregas')
    app.register_blueprint(solicitudes_bp, url_prefix='/api/solicitudes-georef')

    _ready = {'done': False}

    @app.before_request
    def _init_db():
        if not _ready['done']:
            db.create_all()
            _run_migrations()
            _seed_config(db)
            _seed_admin(db)
            _ready['done'] = True

    if os.path.isdir(REACT_BUILD):
        @app.route('/', defaults={'path': ''})
        @app.route('/<path:path>')
        def serve_react(path):
            full = os.path.join(REACT_BUILD, path)
            if path and os.path.isfile(full):
                return send_from_directory(REACT_BUILD, path)
            return send_from_directory(REACT_BUILD, 'index.html')

    return app


def _run_migrations():
    from sqlalchemy import text
    with db.engine.connect() as conn:
        # Drop legacy consignment tables (order matters due to FKs)
        conn.execute(text("DROP TABLE IF EXISTS reportes_venta_detalle CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS reportes_venta CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS ordenes_despacho_detalle CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS devoluciones_detalle CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS devoluciones CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS ordenes_despacho CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS stock_consignacion CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS entradas_inventario CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS inventario_central CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS tasas_bcv CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS clientes_lista_precios CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS productos_precios CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS listas_precios CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS clientes_telefonos CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS grupos_clientes CASCADE"))

        # Add new columns to clientes
        conn.execute(text(
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS vendedor_id INTEGER REFERENCES usuarios(id)"
        ))
        conn.execute(text(
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS empresa VARCHAR(20) DEFAULT 'confibox'"
        ))
        conn.execute(text(
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS telefono VARCHAR(30)"
        ))
        conn.execute(text(
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS latitud NUMERIC(10,8)"
        ))
        conn.execute(text(
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS longitud NUMERIC(11,8)"
        ))
        conn.execute(text(
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500)"
        ))

        # Drop legacy clientes columns if they exist
        conn.execute(text(
            "ALTER TABLE clientes DROP COLUMN IF EXISTS grupo_id"
        ))
        conn.execute(text(
            "ALTER TABLE clientes DROP COLUMN IF EXISTS cobrador"
        ))
        conn.execute(text(
            "ALTER TABLE clientes DROP COLUMN IF EXISTS contacto"
        ))
        conn.execute(text(
            "ALTER TABLE clientes DROP COLUMN IF EXISTS vendedor"
        ))

        # Add color to zonas
        conn.execute(text(
            "ALTER TABLE zonas ADD COLUMN IF NOT EXISTS color VARCHAR(20)"
        ))

        # Drop legacy productos columns if they exist
        conn.execute(text(
            "ALTER TABLE productos DROP COLUMN IF EXISTS codigo_barras"
        ))

        # Remove legacy cliente_id from usuarios (no longer needed)
        conn.execute(text(
            "ALTER TABLE usuarios DROP COLUMN IF EXISTS cliente_id"
        ))

        conn.commit()


def _seed_config(db):
    from app.models import ConfigEmpresa
    if not ConfigEmpresa.query.first():
        db.session.add(ConfigEmpresa(
            nombre='CONFIBOX C.A.',
            rif='J-00000000-0',
            direccion='Dirección de la empresa',
            ciudad='Ciudad'
        ))
        db.session.commit()


def _seed_admin(db):
    from app.models import Usuario
    if not Usuario.query.filter_by(rol='admin').first():
        u = Usuario(username='admin', rol='admin')
        u.set_password('admin123')
        db.session.add(u)
        db.session.commit()
