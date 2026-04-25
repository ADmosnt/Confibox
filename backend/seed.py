"""
Seed script — inserta datos de prueba en la base de datos.

Uso:
  python seed.py           # inserta todo
  python seed.py --clear   # borra datos existentes y vuelve a insertar

En Railway:
  railway run python seed.py
"""
import os
import sys
import datetime

# ── App context ────────────────────────────────────────────────────────────────
os.environ.setdefault('DATABASE_URL', 'postgresql://appuser:dev@localhost:5432/consignacion')

from app import create_app, db
from app.models import (
    Usuario, Zona, Cliente, GrupoProducto, Producto, Lote,
    Pedido, PedidoDetalle, EntregaDiaria,
)

app = create_app()

CLEAR = '--clear' in sys.argv


def seed():
    with app.app_context():
        if CLEAR:
            print('🗑  Limpiando datos de prueba...')
            EntregaDiaria.query.delete()
            PedidoDetalle.query.delete()
            Pedido.query.delete()
            Lote.query.delete()
            Cliente.query.filter(Cliente.codigo.like('TEST-%')).delete(synchronize_session=False)
            Producto.query.filter(Producto.codigo.like('TEST-%')).delete(synchronize_session=False)
            Usuario.query.filter(Usuario.username.in_([
                'vendedor1', 'facturacion1', 'almacenista1', 'chofer1', 'chofer2'
            ])).delete(synchronize_session=False)
            db.session.commit()
            print('   Listo.')

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
                u = Usuario(username=username, rol=rol)
                u.set_password('pass1234')
                db.session.add(u)
                print(f'   + {username} ({rol})  →  pass1234')
            else:
                print(f'   ↩  {username} ya existe')
            user_objs[username] = u
        db.session.flush()

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
            ('TEST-001', 'L240215', 15, hoy + datetime.timedelta(days=12),  'A-01'),  # próximo a vencer
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
            # codigo, razon_social, zona, empresa, lat, lon, direccion, vendedor_key
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

        # Pendiente — listo para que facturacion lo procese
        make_pedido('PED-2024-001', 'TEST-T01', 'pendiente', 'vendedor1', [
            ('TEST-001', 3, 0),
            ('TEST-003', 2, 5),
        ])

        # Facturado — listo para que almacenista haga picking
        p_facturado = make_pedido('PED-2024-002', 'TEST-T02', 'facturado', 'vendedor1', [
            ('TEST-002', 5, 0),
            ('TEST-004', 2, 0),
        ], facturador=facturacion_user)

        # En ruta — asignado al chofer1
        p_ruta = make_pedido('PED-2024-003', 'TEST-T03', 'en_ruta', 'vendedor1', [
            ('TEST-001', 2, 0),
            ('TEST-005', 1, 10),
        ], facturador=facturacion_user)

        db.session.flush()

        # ── Entrega para el pedido en ruta ─────────────────────────────────────
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
        print('  admin          / admin123  →  admin')
        print('  vendedor1      / pass1234  →  vendedor')
        print('  facturacion1   / pass1234  →  facturacion')
        print('  almacenista1   / pass1234  →  almacenista')
        print('  chofer1        / pass1234  →  chofer (tiene PED-2024-003 en ruta)')
        print('  chofer2        / pass1234  →  chofer')
        print('\n─── Pedidos creados ───────────────────────────────────')
        print('  PED-2024-001  pendiente   → Abasto La Esperanza (Charallave)')
        print('  PED-2024-002  facturado   → Bodegón El Refresco (Ocumare)')
        print('  PED-2024-003  en_ruta     → Supermercado El Valle (Los Valles)')
        print('                             asignado a chofer1')
        print('───────────────────────────────────────────────────────')


if __name__ == '__main__':
    seed()
