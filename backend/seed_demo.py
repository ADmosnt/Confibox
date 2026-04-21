"""Populate the DB with demo data for development."""
import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from app.models import (
    ConfigEmpresa, Zona, GrupoProducto,
    Producto, Cliente, Lote, Pedido, PedidoDetalle, Usuario,
)


def seed():
    app = create_app()
    with app.app_context():
        db.create_all()

        # ── Company config ─────────────────────────────────────────────────
        if not ConfigEmpresa.query.first():
            db.session.add(ConfigEmpresa(
                nombre='CONFIBOX C.A.',
                rif='J-12345678-9',
                direccion='Calle Principal, Galpón Industrial',
                ciudad='Los Teques',
            ))

        # ── Zones ──────────────────────────────────────────────────────────
        zonas_data = [
            ('Charallave', '#3B82F6'),
            ('Ocumare del Tuy', '#F59E0B'),
            ('Santa Teresa del Tuy', '#10B981'),
            ('Los Teques', '#8B5CF6'),
        ]
        zonas = {}
        for nombre, color in zonas_data:
            z = Zona.query.filter_by(nombre=nombre).first()
            if not z:
                z = Zona(nombre=nombre, color=color)
                db.session.add(z)
                db.session.flush()
            zonas[nombre] = z

        # ── Product groups ─────────────────────────────────────────────────
        grupos_data = ['Confitería', 'Bebidas', 'Lácteos', 'Snacks']
        grupos = {}
        for nombre in grupos_data:
            g = GrupoProducto.query.filter_by(nombre=nombre).first()
            if not g:
                g = GrupoProducto(nombre=nombre)
                db.session.add(g)
                db.session.flush()
            grupos[nombre] = g

        # ── Products ───────────────────────────────────────────────────────
        productos_data = [
            ('GALL-001', 'Galletas Oreo 36g', 24, 'Confitería'),
            ('GALL-002', 'Galletas Club Social x6', 12, 'Confitería'),
            ('CHOC-001', 'Chocolate Savoy 45g', 24, 'Confitería'),
            ('CHOC-002', 'Chocolate Plástico 25g', 50, 'Confitería'),
            ('VASOS-001', 'Vasos Plásticos 7oz x100', 4, 'Confitería'),
            ('LECHE-001', 'Leche Campiña 125g', 36, 'Lácteos'),
            ('LECHE-002', 'Leche Campiña 400g', 24, 'Lácteos'),
            ('LECHE-003', 'Leche Campiña 800g', 12, 'Lácteos'),
            ('SNACK-001', 'Papas Pringles 40g', 18, 'Snacks'),
        ]
        productos = {}
        for codigo, desc, upb, grupo_nombre in productos_data:
            p = Producto.query.filter_by(codigo=codigo).first()
            if not p:
                p = Producto(
                    codigo=codigo,
                    descripcion=desc,
                    unidades_por_bulto=upb,
                    grupo_id=grupos[grupo_nombre].id,
                )
                db.session.add(p)
                db.session.flush()
            productos[codigo] = p

        # ── Users ──────────────────────────────────────────────────────────
        users_data = [
            ('admin', 'admin123', 'admin'),
            ('vendedor1', 'pass123', 'vendedor'),
            ('facturacion1', 'pass123', 'facturacion'),
            ('almacen1', 'pass123', 'almacenista'),
            ('chofer1', 'pass123', 'chofer'),
            ('chofer2', 'pass123', 'chofer'),
        ]
        users = {}
        for username, password, rol in users_data:
            u = Usuario.query.filter_by(username=username).first()
            if not u:
                u = Usuario(username=username, rol=rol)
                u.set_password(password)
                db.session.add(u)
                db.session.flush()
            users[username] = u

        # ── Stores ─────────────────────────────────────────────────────────
        tiendas_data = [
            ('T-001', 'Bodega El Rincón', 'V-12345678', 'Calle Bolívar #15',
             'Charallave', 'confibox', '0412-1234567', 10.2320, -66.8540),
            ('T-002', 'Abastos El Carmen', 'J-87654321-0', 'Av. Principal #32',
             'Charallave', 'ambos', '0416-7654321', 10.2345, -66.8560),
            ('T-003', 'Licorería Don Pedro', None, 'Calle Miranda #8',
             'Ocumare del Tuy', 'confibox', '0424-1122334', 10.1150, -66.7760),
            ('T-004', 'Minimarket Las Flores', 'V-98765432', 'Urb. Las Flores #5',
             'Santa Teresa del Tuy', 'actual', '0412-5544332', 10.2100, -66.6800),
            ('T-005', 'Distribuidora Norte', 'J-11223344-5', 'Calle Norte #22',
             'Los Teques', 'ambos', '0212-3456789', 10.3462, -67.0393),
        ]
        tiendas = {}
        for codigo, razon, rif, dir_, zona_nombre, empresa, tel, lat, lng in tiendas_data:
            c = Cliente.query.filter_by(codigo=codigo).first()
            if not c:
                c = Cliente(
                    codigo=codigo,
                    razon_social=razon,
                    rif=rif,
                    direccion=dir_,
                    zona_id=zonas[zona_nombre].id,
                    vendedor_id=users['vendedor1'].id,
                    empresa=empresa,
                    telefono=tel,
                    latitud=lat,
                    longitud=lng,
                )
                db.session.add(c)
                db.session.flush()
            tiendas[codigo] = c

        # ── Lots (inventory) ───────────────────────────────────────────────
        lotes_data = [
            ('GALL-001', 50, datetime.date(2025, 8, 1), 'Pasillo A, Estante 1'),
            ('GALL-001', 30, datetime.date(2025, 12, 1), 'Pasillo A, Estante 1'),
            ('GALL-002', 40, datetime.date(2025, 9, 15), 'Pasillo A, Estante 2'),
            ('CHOC-001', 60, datetime.date(2025, 7, 31), 'Pasillo B, Estante 1'),
            ('CHOC-002', 100, datetime.date(2026, 3, 1), 'Pasillo B, Estante 2'),
            ('VASOS-001', 20, None, 'Pasillo C'),
            ('LECHE-001', 80, datetime.date(2025, 6, 30), 'Pasillo D, Estante 1'),
            ('LECHE-002', 60, datetime.date(2025, 10, 1), 'Pasillo D, Estante 2'),
            ('LECHE-003', 25, datetime.date(2025, 11, 1), 'Pasillo D, Estante 3'),
            ('SNACK-001', 45, datetime.date(2025, 8, 15), 'Pasillo E'),
        ]
        if not Lote.query.first():
            for codigo, bultos, venc, ubic in lotes_data:
                db.session.add(Lote(
                    producto_id=productos[codigo].id,
                    cantidad_bultos=bultos,
                    fecha_vencimiento=venc,
                    ubicacion_almacen=ubic,
                ))

        # ── Sample pedido ──────────────────────────────────────────────────
        if not Pedido.query.first():
            from app.utils import siguiente_numero_pedido
            pedido = Pedido(
                numero_pedido=siguiente_numero_pedido(db, Pedido),
                tienda_id=tiendas['T-001'].id,
                vendedor_id=users['vendedor1'].id,
                estado='facturado',
                facturado_por=users['facturacion1'].id,
                facturado_en=datetime.datetime.utcnow(),
                nota='Pedido de prueba',
            )
            db.session.add(pedido)
            db.session.flush()
            db.session.add(PedidoDetalle(
                pedido_id=pedido.id,
                producto_id=productos['GALL-001'].id,
                cantidad_bultos=5,
                cantidad_unidades=0,
            ))
            db.session.add(PedidoDetalle(
                pedido_id=pedido.id,
                producto_id=productos['CHOC-001'].id,
                cantidad_bultos=2,
                cantidad_unidades=6,
            ))

        db.session.commit()
        print("Demo data seeded.")
        print("Users: admin/admin123, vendedor1/pass123, facturacion1/pass123,")
        print("       almacen1/pass123, chofer1/pass123, chofer2/pass123")


if __name__ == '__main__':
    seed()
