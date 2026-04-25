"""
Seed script — inserta datos de prueba en la base de datos.

Uso:
  python seed.py           # inserta todo
  python seed.py --clear   # borra datos existentes y vuelve a insertar
  python seed.py --check   # solo verifica si los usuarios de prueba existen
  python seed.py --reset-passwords  # resetea contraseñas de usuarios de prueba a pass1234

Asegúrate de tener DATABASE_URL apuntando a la BD correcta antes de correr:
  Linux/Mac:   export DATABASE_URL="postgresql://user:pass@host:port/db"
  PowerShell:  $env:DATABASE_URL = "postgresql://user:pass@host:port/db"
  CMD:         set DATABASE_URL=postgresql://user:pass@host:port/db
"""
import os
import sys
import datetime
import traceback

# ── DB URL ─────────────────────────────────────────────────────────────────────
raw_url = os.environ.get('DATABASE_URL', '')
if not raw_url:
    print('⚠  DATABASE_URL no está definida. Usando BD local por defecto.')
    raw_url = 'postgresql://appuser:dev@localhost:5432/consignacion'
else:
    # Mask password for display
    try:
        from urllib.parse import urlparse
        parsed = urlparse(raw_url)
        masked = raw_url.replace(parsed.password or '', '***') if parsed.password else raw_url
        print(f'🔗 Conectando a: {masked}')
    except Exception:
        print(f'🔗 DATABASE_URL está definida.')

# Fix Railway's legacy postgres:// scheme
if raw_url.startswith('postgres://'):
    raw_url = raw_url.replace('postgres://', 'postgresql://', 1)
    print('   (esquema postgres:// → postgresql:// corregido)')

os.environ['DATABASE_URL'] = raw_url

# ── App context ────────────────────────────────────────────────────────────────
try:
    from app import create_app, db
    from app.models import (
        Usuario, Zona, Cliente, GrupoProducto, Producto, Lote,
        Pedido, PedidoDetalle, EntregaDiaria,
    )
except ImportError as e:
    print(f'\n❌ Error importando la app: {e}')
    print('   Asegúrate de correr este script desde el directorio /backend')
    sys.exit(1)

app = create_app()

CLEAR = '--clear' in sys.argv
CHECK = '--check' in sys.argv
RESET_PASSWORDS = '--reset-passwords' in sys.argv

TEST_USERNAMES = ['vendedor1', 'facturacion1', 'almacenista1', 'chofer1', 'chofer2']
TEST_PASSWORD = 'pass1234'


def check_users():
    """Verifica qué usuarios existen en la BD."""
    with app.app_context():
        print('\n─── Estado de usuarios en la BD ───────────────────────────')
        all_users = Usuario.query.all()
        print(f'   Total usuarios: {len(all_users)}')
        for u in all_users:
            hash_len = len(u.password_hash) if u.password_hash else 0
            print(f'   {u.username:<20} rol={u.rol:<15} activo={u.activo}  hash_len={hash_len}')
        print('───────────────────────────────────────────────────────────\n')

        missing = [un for un in TEST_USERNAMES if not any(u.username == un for u in all_users)]
        if missing:
            print(f'⚠  Usuarios de prueba que NO existen: {", ".join(missing)}')
            print('   Corre: python seed.py  para crearlos')
        else:
            print('✅ Todos los usuarios de prueba existen en la BD.')

        # Verify passwords work
        print('\n─── Verificando contraseñas ───────────────────────────────')
        for u in all_users:
            if u.username in TEST_USERNAMES:
                ok = u.check_password(TEST_PASSWORD)
                status = '✅' if ok else '❌'
                print(f'   {status} {u.username} / {TEST_PASSWORD}  →  {"CORRECTO" if ok else "FALLA"}')
        print('───────────────────────────────────────────────────────────\n')


def reset_passwords():
    """Resetea contraseñas de usuarios de prueba."""
    with app.app_context():
        updated = 0
        for username in TEST_USERNAMES:
            u = Usuario.query.filter_by(username=username).first()
            if u:
                u.set_password(TEST_PASSWORD)
                print(f'   🔑 {username} → contraseña reseteada a {TEST_PASSWORD}')
                updated += 1
            else:
                print(f'   ⚠  {username} no existe (corre python seed.py primero)')
        db.session.commit()
        print(f'\n✅ {updated} contraseñas reseteadas.')


def seed():
    with app.app_context():
        # Ensure tables exist
        db.create_all()

        if CLEAR:
            print('🗑  Limpiando datos de prueba...')
            try:
                EntregaDiaria.query.delete()
                PedidoDetalle.query.delete()
                Pedido.query.delete()
                Lote.query.filter(Lote.numero_lote.in_([
                    'L240101', 'L240215', 'L240301', 'L240201', 'L240115', 'L240320'
                ])).delete(synchronize_session=False)
                Cliente.query.filter(Cliente.codigo.like('TEST-%')).delete(synchronize_session=False)
                Producto.query.filter(Producto.codigo.like('TEST-%')).delete(synchronize_session=False)
                Usuario.query.filter(Usuario.username.in_(TEST_USERNAMES)).delete(synchronize_session=False)
                db.session.commit()
                print('   Listo.')
            except Exception as e:
                db.session.rollback()
                print(f'❌ Error al limpiar: {e}')
                raise

        # ── Usuarios ───────────────────────────────────────────────────────────
        print('👤 Creando usuarios...')
        usuarios = {
            'vendedor1':     'vendedor',
            'facturacion1':  'facturacion',
            'almacenista1':  'almacenista',
            'chofer1':       'chofer',
            'chofer2':       'chofer',
        }
        user_objs = {}
        for username, rol in usuarios.items():
            u = Usuario.query.filter_by(username=username).first()
            if not u:
                u = Usuario(username=username, rol=rol, activo=True)
                u.set_password(TEST_PASSWORD)
                db.session.add(u)
                print(f'   + {username} ({rol})')
            else:
                print(f'   ↩  {username} ya existe')
            user_objs[username] = u
        db.session.flush()

        # Verify IDs were assigned
        for username, u in user_objs.items():
            if u.id is None:
                raise RuntimeError(f'Usuario {username} no tiene ID después de flush()')

        admin = Usuario.query.filter_by(rol='admin').first()

        # ── Zonas ──────────────────────────────────────────────────────────────
        print('🗺  Creando zonas...')
        zonas_data = [
            ('Charallave', '#3B82F6'),
            ('Ocumare del Tuy', '#F59E0B'),
            ('Santa Teresa del Tuy', '#10B981'),
            ('Los Valles del Tuy', '#8B5CF6'),
        ]
        zona_objs = {}
        for nombre, color in zonas_data:
            z = Zona.query.filter_by(nombre=nombre).first()
            if not z:
                z = Zona(nombre=nombre, color=color)
                db.session.add(z)
                print(f'   + {nombre}')
            zona_objs[nombre] = z
        db.session.flush()

        # ── Grupos de productos ────────────────────────────────────────────────
        print('📦 Creando grupos de productos...')
        grupos_data = ['Confitería', 'Snacks', 'Bebidas', 'Galletas']
        grupo_objs = {}
        for nombre in grupos_data:
            g = GrupoProducto.query.filter_by(nombre=nombre).first()
            if not g:
                g = GrupoProducto(nombre=nombre)
                db.session.add(g)
            grupo_objs[nombre] = g
        db.session.flush()

        # ── Productos ──────────────────────────────────────────────────────────
        print('🍬 Creando productos...')
        productos_data = [
            ('TEST-001', 'Chocolatines Rellenos 20g x 24', 24, 'Confitería'),
            ('TEST-002', 'Paletas Surtidas x 30',          30, 'Confitería'),
            ('TEST-003', 'Chupetas Cola x 48',             48, 'Confitería'),
            ('TEST-004', 'Galletas Cream 180g x 12',       12, 'Galletas'),
            ('TEST-005', 'Caramelos Surtidos x 100',      100, 'Confitería'),
        ]
        prod_objs = {}
        for codigo, desc, upb, grupo in productos_data:
            p = Producto.query.filter_by(codigo=codigo).first()
            if not p:
                p = Producto(
                    codigo=codigo,
                    descripcion=desc,
                    unidades_por_bulto=upb,
                    grupo_id=grupo_objs[grupo].id,
                )
                db.session.add(p)
                print(f'   + {codigo} — {desc}')
            prod_objs[codigo] = p
        db.session.flush()

        # ── Lotes ──────────────────────────────────────────────────────────────
        print('🏭 Creando lotes de inventario...')
        hoy = datetime.date.today()
        lotes_data = [
            ('TEST-001', 'L240101', 20, hoy + datetime.timedelta(days=90),  'A-01'),
            ('TEST-001', 'L240215', 15, hoy + datetime.timedelta(days=12),  'A-01'),
            ('TEST-002', 'L240301', 30, hoy + datetime.timedelta(days=180), 'A-02'),
            ('TEST-003', 'L240201', 25, hoy + datetime.timedelta(days=60),  'B-01'),
            ('TEST-004', 'L240115', 18, hoy + datetime.timedelta(days=45),  'B-02'),
            ('TEST-005', 'L240320', 40, hoy + datetime.timedelta(days=200), 'C-01'),
        ]
        if not Lote.query.filter_by(numero_lote='L240101').first():
            for codigo, num_lote, bultos, vence, ubicacion in lotes_data:
                l = Lote(
                    producto_id=prod_objs[codigo].id,
                    numero_lote=num_lote,
                    cantidad_bultos=bultos,
                    fecha_vencimiento=vence,
                    ubicacion_almacen=ubicacion,
                    fecha_ingreso=hoy,
                )
                db.session.add(l)
            print(f'   + {len(lotes_data)} lotes creados')
        else:
            print('   ↩  Lotes ya existen')
        db.session.flush()

        # ── Tiendas ────────────────────────────────────────────────────────────
        print('🏪 Creando tiendas...')
        tiendas_data = [
            ('TEST-T01', 'Abasto La Esperanza',    'Charallave',          'confibox', 10.2423, -66.8756, 'Calle Principal, Charallave',        'vendedor1'),
            ('TEST-T02', 'Bodegón El Refresco',    'Ocumare del Tuy',     'actual',   10.2850, -66.7870, 'Av. Bolívar, Ocumare del Tuy',        'vendedor1'),
            ('TEST-T03', 'Supermercado El Valle',  'Los Valles del Tuy',  'ambos',    10.2190, -66.9140, 'Centro Comercial, Los Valles del Tuy', 'vendedor1'),
            ('TEST-T04', 'Licorería San Juan',     'Charallave',          'confibox', 10.2398, -66.8801, 'Urb. San Juan, Charallave',           'vendedor1'),
            ('TEST-T05', 'Distribuidora Miranda',  'Santa Teresa del Tuy','confibox', 10.2210, -66.6620, 'Av. Principal, Santa Teresa',         'vendedor1'),
        ]
        tienda_objs = {}
        for codigo, razon, zona_nombre, empresa, lat, lon, direccion, vendedor_key in tiendas_data:
            t = Cliente.query.filter_by(codigo=codigo).first()
            if not t:
                t = Cliente(
                    codigo=codigo,
                    razon_social=razon,
                    zona_id=zona_objs[zona_nombre].id,
                    empresa=empresa,
                    latitud=lat,
                    longitud=lon,
                    direccion=direccion,
                    vendedor_id=user_objs[vendedor_key].id,
                )
                db.session.add(t)
                print(f'   + {codigo} — {razon}')
            tienda_objs[codigo] = t
        db.session.flush()

        # ── Pedidos ────────────────────────────────────────────────────────────
        print('📋 Creando pedidos...')

        def make_pedido(numero, tienda_key, estado, vendedor_key, detalles, facturador=None):
            if Pedido.query.filter_by(numero_pedido=numero).first():
                print(f'   ↩  {numero} ya existe')
                return None
            p = Pedido(
                numero_pedido=numero,
                tienda_id=tienda_objs[tienda_key].id,
                vendedor_id=user_objs[vendedor_key].id,
                estado=estado,
                facturado_por=facturador.id if facturador else None,
                facturado_en=datetime.datetime.utcnow() if facturador else None,
            )
            db.session.add(p)
            db.session.flush()
            for prod_codigo, bultos, unidades in detalles:
                db.session.add(PedidoDetalle(
                    pedido_id=p.id,
                    producto_id=prod_objs[prod_codigo].id,
                    cantidad_bultos=bultos,
                    cantidad_unidades=unidades,
                ))
            print(f'   + {numero} ({estado}) → {tienda_objs[tienda_key].razon_social}')
            return p

        facturacion_user = user_objs['facturacion1']

        make_pedido('PED-2024-001', 'TEST-T01', 'pendiente', 'vendedor1', [
            ('TEST-001', 3, 0),
            ('TEST-003', 2, 5),
        ])

        p_facturado = make_pedido('PED-2024-002', 'TEST-T02', 'facturado', 'vendedor1', [
            ('TEST-002', 5, 0),
            ('TEST-004', 2, 0),
        ], facturador=facturacion_user)

        p_ruta = make_pedido('PED-2024-003', 'TEST-T03', 'en_ruta', 'vendedor1', [
            ('TEST-001', 2, 0),
            ('TEST-005', 1, 10),
        ], facturador=facturacion_user)

        db.session.flush()

        if p_ruta and not EntregaDiaria.query.filter_by(pedido_id=p_ruta.id).first():
            entrega = EntregaDiaria(
                pedido_id=p_ruta.id,
                chofer_id=user_objs['chofer1'].id,
                estado='pendiente',
            )
            db.session.add(entrega)
            print(f'   + Entrega asignada a chofer1 → {tienda_objs["TEST-T03"].razon_social}')

        db.session.commit()

        print('\n✅ Seed completado.')
        print('\n─── Usuarios de prueba ────────────────────────────────')
        print(f'  admin          / admin123  →  admin')
        print(f'  vendedor1      / {TEST_PASSWORD}  →  vendedor')
        print(f'  facturacion1   / {TEST_PASSWORD}  →  facturacion')
        print(f'  almacenista1   / {TEST_PASSWORD}  →  almacenista')
        print(f'  chofer1        / {TEST_PASSWORD}  →  chofer (tiene PED-2024-003 en ruta)')
        print(f'  chofer2        / {TEST_PASSWORD}  →  chofer')
        print('\n─── Pedidos creados ───────────────────────────────────')
        print('  PED-2024-001  pendiente   → Abasto La Esperanza (Charallave)')
        print('  PED-2024-002  facturado   → Bodegón El Refresco (Ocumare)')
        print('  PED-2024-003  en_ruta     → Supermercado El Valle (Los Valles)')
        print('                             asignado a chofer1')
        print('───────────────────────────────────────────────────────')


if __name__ == '__main__':
    try:
        if CHECK:
            check_users()
        elif RESET_PASSWORDS:
            reset_passwords()
        else:
            seed()
    except Exception:
        print('\n❌ El seed falló con el siguiente error:')
        traceback.print_exc()
        sys.exit(1)
