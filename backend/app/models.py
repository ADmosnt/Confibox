from app import db
import datetime


class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(512), nullable=False)
    # admin | vendedor | facturacion | almacenista | chofer
    rol = db.Column(db.String(20), nullable=False, default='admin')
    activo = db.Column(db.Boolean, default=True)

    def set_password(self, pw):
        from werkzeug.security import generate_password_hash
        self.password_hash = generate_password_hash(pw)

    def check_password(self, pw):
        from werkzeug.security import check_password_hash
        return check_password_hash(self.password_hash, pw)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'rol': self.rol,
            'activo': self.activo,
        }


class ConfigEmpresa(db.Model):
    __tablename__ = 'config_empresa'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(200), nullable=False)
    rif = db.Column(db.String(20), nullable=False)
    direccion = db.Column(db.Text, nullable=False)
    ciudad = db.Column(db.String(100), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'rif': self.rif,
            'direccion': self.direccion,
            'ciudad': self.ciudad,
        }


class Zona(db.Model):
    __tablename__ = 'zonas'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False, unique=True)
    color = db.Column(db.String(20))

    def to_dict(self):
        return {'id': self.id, 'nombre': self.nombre, 'color': self.color}


class GrupoProducto(db.Model):
    __tablename__ = 'grupos_productos'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False, unique=True)

    def to_dict(self):
        return {'id': self.id, 'nombre': self.nombre}


class GrupoCliente(db.Model):
    __tablename__ = 'grupos_clientes'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False, unique=True)
    descripcion = db.Column(db.String(200))

    def to_dict(self):
        return {'id': self.id, 'nombre': self.nombre, 'descripcion': self.descripcion}


class Producto(db.Model):
    __tablename__ = 'productos'
    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(30), nullable=False, unique=True)
    descripcion = db.Column(db.String(200), nullable=False)
    unidades_por_bulto = db.Column(db.Integer, nullable=False, default=1)
    grupo_id = db.Column(db.Integer, db.ForeignKey('grupos_productos.id'))
    activo = db.Column(db.Boolean, default=True)

    grupo = db.relationship('GrupoProducto', backref='productos')

    def to_dict(self):
        return {
            'id': self.id,
            'codigo': self.codigo,
            'descripcion': self.descripcion,
            'unidades_por_bulto': self.unidades_por_bulto,
            'grupo_id': self.grupo_id,
            'grupo': self.grupo.nombre if self.grupo else None,
            'activo': self.activo,
        }


class Cliente(db.Model):
    # Semantically a "tienda" (store/delivery point) but keeping table name
    # to avoid breaking FK references everywhere.
    __tablename__ = 'clientes'
    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(20), nullable=False, unique=True)
    razon_social = db.Column(db.String(200), nullable=False)
    rif = db.Column(db.String(20))
    direccion = db.Column(db.Text)
    zona_id = db.Column(db.Integer, db.ForeignKey('zonas.id'))
    grupo_cliente_id = db.Column(db.Integer, db.ForeignKey('grupos_clientes.id'), nullable=True)
    vendedor_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)
    # confibox | actual | ambos
    empresa = db.Column(db.String(20), default='confibox')
    telefono = db.Column(db.String(30))
    latitud = db.Column(db.Numeric(10, 8))
    longitud = db.Column(db.Numeric(11, 8))
    foto_url = db.Column(db.String(500))
    observaciones = db.Column(db.Text)
    activo = db.Column(db.Boolean, default=True)

    zona = db.relationship('Zona', backref='clientes')
    grupo_cliente = db.relationship('GrupoCliente', backref='clientes')
    vendedor = db.relationship('Usuario', foreign_keys=[vendedor_id])

    def to_dict(self):
        return {
            'id': self.id,
            'codigo': self.codigo,
            'razon_social': self.razon_social,
            'rif': self.rif,
            'direccion': self.direccion,
            'zona_id': self.zona_id,
            'zona': self.zona.nombre if self.zona else None,
            'zona_color': self.zona.color if self.zona else None,
            'grupo_cliente_id': self.grupo_cliente_id,
            'grupo_cliente': self.grupo_cliente.nombre if self.grupo_cliente else None,
            'vendedor_id': self.vendedor_id,
            'vendedor': self.vendedor.username if self.vendedor else None,
            'empresa': self.empresa,
            'telefono': self.telefono,
            'latitud': float(self.latitud) if self.latitud is not None else None,
            'longitud': float(self.longitud) if self.longitud is not None else None,
            'foto_url': self.foto_url,
            'observaciones': self.observaciones,
            'activo': self.activo,
        }


class Lote(db.Model):
    __tablename__ = 'lotes'
    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id'), nullable=False)
    numero_lote = db.Column(db.String(50))
    cantidad_bultos = db.Column(db.Integer, nullable=False, default=0)
    fecha_vencimiento = db.Column(db.Date)
    ubicacion_almacen = db.Column(db.String(100))   # legacy free text — kept for back-compat
    ubicacion_id = db.Column(db.Integer, db.ForeignKey('ubicaciones.id'), nullable=True)
    nivel = db.Column(db.Integer)                   # 1..N for racks; NULL for piso
    fecha_ingreso = db.Column(db.Date, nullable=False, default=datetime.date.today)
    nota = db.Column(db.Text)
    creado_en = db.Column(db.DateTime(timezone=True), default=datetime.datetime.utcnow)

    producto = db.relationship('Producto', backref='lotes')
    ubicacion = db.relationship('Ubicacion', backref='lotes')

    def to_dict(self):
        p = self.producto
        upb = p.unidades_por_bulto if p else 1
        u = self.ubicacion
        # Computed label: structured location wins over legacy text
        if u:
            label = f"{u.codigo}-N{self.nivel}" if u.tipo == 'rack' and self.nivel else u.codigo
        else:
            label = self.ubicacion_almacen
        return {
            'id': self.id,
            'producto_id': self.producto_id,
            'codigo': p.codigo if p else None,
            'descripcion': p.descripcion if p else None,
            'unidades_por_bulto': upb,
            'numero_lote': self.numero_lote,
            'cantidad_bultos': self.cantidad_bultos,
            'cantidad_unidades': self.cantidad_bultos * upb,
            'fecha_vencimiento': self.fecha_vencimiento.isoformat() if self.fecha_vencimiento else None,
            'ubicacion_almacen': label,
            'ubicacion_id': self.ubicacion_id,
            'ubicacion_codigo': u.codigo if u else None,
            'nivel': self.nivel,
            'fecha_ingreso': self.fecha_ingreso.isoformat(),
            'nota': self.nota,
        }


class Pedido(db.Model):
    __tablename__ = 'pedidos'
    id = db.Column(db.Integer, primary_key=True)
    numero_pedido = db.Column(db.String(20), nullable=False, unique=True)
    tienda_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=False)
    vendedor_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    # pendiente | facturado | en_ruta | entregado | con_incidencia | anulado
    estado = db.Column(db.String(20), default='pendiente')
    facturado_por = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)
    facturado_en = db.Column(db.DateTime(timezone=True))
    nota = db.Column(db.Text)
    creado_en = db.Column(db.DateTime(timezone=True), default=datetime.datetime.utcnow)

    tienda = db.relationship('Cliente', backref='pedidos', foreign_keys=[tienda_id])
    vendedor = db.relationship('Usuario', foreign_keys=[vendedor_id])
    facturador = db.relationship('Usuario', foreign_keys=[facturado_por])
    detalles = db.relationship('PedidoDetalle', backref='pedido', cascade='all, delete-orphan')

    def to_dict(self, include_detalles=False):
        d = {
            'id': self.id,
            'numero_pedido': self.numero_pedido,
            'tienda_id': self.tienda_id,
            'tienda': self.tienda.razon_social if self.tienda else None,
            'tienda_zona': self.tienda.zona.nombre if self.tienda and self.tienda.zona else None,
            'vendedor_id': self.vendedor_id,
            'vendedor': self.vendedor.username if self.vendedor else None,
            'estado': self.estado,
            'facturado_por': self.facturado_por,
            'facturado_en': self.facturado_en.isoformat() if self.facturado_en else None,
            'nota': self.nota,
            'creado_en': self.creado_en.isoformat() if self.creado_en else None,
        }
        if include_detalles:
            d['detalles'] = [det.to_dict() for det in self.detalles]
        return d


class PedidoDetalle(db.Model):
    __tablename__ = 'pedidos_detalle'
    id = db.Column(db.Integer, primary_key=True)
    pedido_id = db.Column(db.Integer, db.ForeignKey('pedidos.id', ondelete='CASCADE'), nullable=False)
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id'), nullable=False)
    cantidad_bultos = db.Column(db.Integer, nullable=False, default=0)
    cantidad_unidades = db.Column(db.Integer, nullable=False, default=0)  # unidades sueltas

    producto = db.relationship('Producto')

    def to_dict(self):
        p = self.producto
        upb = p.unidades_por_bulto if p else 1
        return {
            'id': self.id,
            'producto_id': self.producto_id,
            'codigo': p.codigo if p else None,
            'descripcion': p.descripcion if p else None,
            'unidades_por_bulto': upb,
            'cantidad_bultos': self.cantidad_bultos,
            'cantidad_unidades': self.cantidad_unidades,
            'total_unidades': (self.cantidad_bultos * upb) + self.cantidad_unidades,
        }


class EntregaDiaria(db.Model):
    __tablename__ = 'entregas_diarias'
    id = db.Column(db.Integer, primary_key=True)
    pedido_id = db.Column(db.Integer, db.ForeignKey('pedidos.id'), nullable=False)
    chofer_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    # pendiente | entregada | rechazada | local_cerrado | parcial
    estado = db.Column(db.String(20), default='pendiente')
    latitud_checkin = db.Column(db.Numeric(10, 8))
    longitud_checkin = db.Column(db.Numeric(11, 8))
    distancia_metros = db.Column(db.Integer)
    # local_cerrado | no_recibio | sin_pago | no_estaba_encargado | otro
    motivo_incidencia = db.Column(db.String(50))
    observacion = db.Column(db.Text)
    foto_evidencia_url = db.Column(db.String(500))
    hora_registro = db.Column(db.DateTime(timezone=True), default=datetime.datetime.utcnow)
    sincronizado_en = db.Column(db.DateTime(timezone=True))
    salida_en = db.Column(db.DateTime(timezone=True))   # when chofer confirmed departure

    pedido = db.relationship('Pedido', backref='entregas')
    chofer = db.relationship('Usuario', foreign_keys=[chofer_id])
    devoluciones = db.relationship('EntregaDevolucion', backref='entrega', cascade='all, delete-orphan')

    def to_dict(self, include_devoluciones=False):
        pedido = self.pedido
        tienda = pedido.tienda if pedido else None
        d = {
            'id': self.id,
            'pedido_id': self.pedido_id,
            'numero_pedido': pedido.numero_pedido if pedido else None,
            'tienda': tienda.razon_social if tienda else None,
            'tienda_id': tienda.id if tienda else None,
            'chofer_id': self.chofer_id,
            'chofer': self.chofer.username if self.chofer else None,
            'estado': self.estado,
            'latitud_checkin': float(self.latitud_checkin) if self.latitud_checkin is not None else None,
            'longitud_checkin': float(self.longitud_checkin) if self.longitud_checkin is not None else None,
            'distancia_metros': self.distancia_metros,
            'motivo_incidencia': self.motivo_incidencia,
            'observacion': self.observacion,
            'foto_evidencia_url': self.foto_evidencia_url,
            'hora_registro': self.hora_registro.isoformat() if self.hora_registro else None,
            'sincronizado_en': self.sincronizado_en.isoformat() if self.sincronizado_en else None,
            'salida_en': self.salida_en.isoformat() if self.salida_en else None,
        }
        if include_devoluciones:
            d['devoluciones'] = [dev.to_dict() for dev in self.devoluciones]
        return d


class EntregaDevolucion(db.Model):
    __tablename__ = 'entregas_devoluciones'
    id = db.Column(db.Integer, primary_key=True)
    entrega_id = db.Column(db.Integer, db.ForeignKey('entregas_diarias.id', ondelete='CASCADE'), nullable=False)
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id'), nullable=False)
    cantidad_bultos = db.Column(db.Integer, nullable=False, default=0)
    cantidad_unidades = db.Column(db.Integer, nullable=False, default=0)
    # error_pedido | mercancia_danada | cliente_no_recibio | otro
    motivo = db.Column(db.String(50))
    reingresa_almacen = db.Column(db.Boolean, nullable=False, default=True)

    producto = db.relationship('Producto')

    def to_dict(self):
        p = self.producto
        upb = p.unidades_por_bulto if p else 1
        return {
            'id': self.id,
            'producto_id': self.producto_id,
            'codigo': p.codigo if p else None,
            'descripcion': p.descripcion if p else None,
            'unidades_por_bulto': upb,
            'cantidad_bultos': self.cantidad_bultos,
            'cantidad_unidades': self.cantidad_unidades,
            'total_unidades': (self.cantidad_bultos * upb) + self.cantidad_unidades,
            'motivo': self.motivo,
            'reingresa_almacen': self.reingresa_almacen,
        }


class RecoveryCode(db.Model):
    __tablename__ = 'recovery_codes'
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    code_hash = db.Column(db.String(512), nullable=False)
    usado_en = db.Column(db.DateTime(timezone=True))
    creado_en = db.Column(db.DateTime(timezone=True), default=datetime.datetime.utcnow)

    usuario = db.relationship('Usuario', backref='recovery_codes')

    def to_dict(self):
        return {
            'id': self.id,
            'usado_en': self.usado_en.isoformat() if self.usado_en else None,
            'creado_en': self.creado_en.isoformat() if self.creado_en else None,
        }


class AlmacenZona(db.Model):
    """Logical grouping rectangle on the warehouse map.
    Pure presentation/container — does not own ubicaciones (loose coupling)."""
    __tablename__ = 'almacen_zonas'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False, unique=True)
    color = db.Column(db.String(20), nullable=False, default='#DBEAFE')
    x = db.Column(db.Integer, nullable=False, default=0)
    y = db.Column(db.Integer, nullable=False, default=0)
    width = db.Column(db.Integer, nullable=False, default=200)
    height = db.Column(db.Integer, nullable=False, default=150)

    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'color': self.color,
            'x': self.x, 'y': self.y,
            'width': self.width, 'height': self.height,
        }


class Ubicacion(db.Model):
    """Physical addressable location: floor spot (piso) or rack with N levels.
    `niveles` is NEVER NULL — piso has 1, rack has N."""
    __tablename__ = 'ubicaciones'
    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(30), nullable=False, unique=True)
    zona_id = db.Column(db.Integer, db.ForeignKey('almacen_zonas.id'), nullable=True)
    tipo = db.Column(db.String(10), nullable=False, default='piso')      # 'piso' | 'rack'
    niveles = db.Column(db.Integer, nullable=False, default=1)
    # Canvas placement — NULL means "exists but not placed on the map yet"
    x = db.Column(db.Integer)
    y = db.Column(db.Integer)
    width = db.Column(db.Integer, default=80)
    height = db.Column(db.Integer, default=60)
    rotacion = db.Column(db.Integer, default=0)
    creado_en = db.Column(db.DateTime(timezone=True), default=datetime.datetime.utcnow)

    zona = db.relationship('AlmacenZona', backref='ubicaciones')

    @property
    def placed(self):
        return self.x is not None and self.y is not None

    def to_dict(self):
        return {
            'id': self.id,
            'codigo': self.codigo,
            'zona_id': self.zona_id,
            'zona': self.zona.nombre if self.zona else None,
            'tipo': self.tipo,
            'niveles': self.niveles,
            'x': self.x, 'y': self.y,
            'width': self.width, 'height': self.height,
            'rotacion': self.rotacion,
            'placed': self.placed,
        }


class JornadaEquipo(db.Model):
    __tablename__ = 'jornada_equipo'
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.Date, nullable=False, default=datetime.date.today)
    chofer_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    ayudante_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    creado_en = db.Column(db.DateTime(timezone=True), default=datetime.datetime.utcnow)

    chofer = db.relationship('Usuario', foreign_keys=[chofer_id])
    ayudante = db.relationship('Usuario', foreign_keys=[ayudante_id])

    __table_args__ = (
        db.UniqueConstraint('fecha', 'ayudante_id', name='uq_jornada_ayudante_dia'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'fecha': self.fecha.isoformat(),
            'chofer_id': self.chofer_id,
            'chofer': self.chofer.username if self.chofer else None,
            'ayudante_id': self.ayudante_id,
            'ayudante': self.ayudante.username if self.ayudante else None,
        }


class SolicitudGeoref(db.Model):
    __tablename__ = 'solicitudes_georef'
    id = db.Column(db.Integer, primary_key=True)
    tienda_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=False)
    chofer_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    latitud_actual = db.Column(db.Numeric(10, 8))
    longitud_actual = db.Column(db.Numeric(11, 8))
    latitud_sugerida = db.Column(db.Numeric(10, 8), nullable=False)
    longitud_sugerida = db.Column(db.Numeric(11, 8), nullable=False)
    motivo = db.Column(db.Text)
    # pendiente | aprobada | rechazada
    estado = db.Column(db.String(20), default='pendiente')
    revisado_por = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)
    revisado_en = db.Column(db.DateTime(timezone=True))
    creado_en = db.Column(db.DateTime(timezone=True), default=datetime.datetime.utcnow)

    tienda = db.relationship('Cliente', backref='solicitudes_georef', foreign_keys=[tienda_id])
    chofer = db.relationship('Usuario', foreign_keys=[chofer_id])
    revisor = db.relationship('Usuario', foreign_keys=[revisado_por])

    def to_dict(self):
        return {
            'id': self.id,
            'tienda_id': self.tienda_id,
            'tienda': self.tienda.razon_social if self.tienda else None,
            'chofer_id': self.chofer_id,
            'chofer': self.chofer.username if self.chofer else None,
            'latitud_actual': float(self.latitud_actual) if self.latitud_actual is not None else None,
            'longitud_actual': float(self.longitud_actual) if self.longitud_actual is not None else None,
            'latitud_sugerida': float(self.latitud_sugerida),
            'longitud_sugerida': float(self.longitud_sugerida),
            'motivo': self.motivo,
            'estado': self.estado,
            'revisado_por': self.revisado_por,
            'revisado_en': self.revisado_en.isoformat() if self.revisado_en else None,
            'creado_en': self.creado_en.isoformat() if self.creado_en else None,
        }
