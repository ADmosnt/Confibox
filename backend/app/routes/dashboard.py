from flask import Blueprint, jsonify, request
import datetime
from sqlalchemy import func
from app import db
from app.models import Cliente, Producto, Pedido, EntregaDiaria, Lote
from app.auth import require_role

bp = Blueprint('dashboard', __name__)


@bp.route('', methods=['GET'])
@require_role('admin', 'almacenista')
def get_dashboard():
    hoy = datetime.date.today()
    mes_inicio = hoy.replace(day=1)
    proximos_dias = hoy + datetime.timedelta(days=30)

    total_tiendas = Cliente.query.filter_by(activo=True).count()
    total_productos = Producto.query.filter_by(activo=True).count()

    pedidos_mes = Pedido.query.filter(
        Pedido.creado_en >= mes_inicio,
        Pedido.estado != 'anulado',
    ).count()

    pedidos_pendientes = Pedido.query.filter(
        Pedido.estado.in_(['pendiente', 'facturado'])
    ).count()

    entregas_hoy = EntregaDiaria.query.filter(
        func.date(EntregaDiaria.hora_registro) == hoy
    ).count()

    entregas_completadas_hoy = EntregaDiaria.query.filter(
        func.date(EntregaDiaria.hora_registro) == hoy,
        EntregaDiaria.estado == 'entregada',
    ).count()

    # Lotes próximos a vencer (next 30 days)
    lotes_por_vencer = Lote.query.filter(
        Lote.fecha_vencimiento != None,
        Lote.fecha_vencimiento <= proximos_dias,
        Lote.fecha_vencimiento >= hoy,
        Lote.cantidad_bultos > 0,
    ).order_by(Lote.fecha_vencimiento).limit(10).all()

    # Recent pedidos
    ultimos_pedidos = Pedido.query.order_by(
        Pedido.creado_en.desc()
    ).limit(5).all()

    return jsonify({
        'total_tiendas': total_tiendas,
        'total_productos': total_productos,
        'pedidos_mes': pedidos_mes,
        'pedidos_pendientes': pedidos_pendientes,
        'entregas_hoy': entregas_hoy,
        'entregas_completadas_hoy': entregas_completadas_hoy,
        'lotes_por_vencer': [l.to_dict() for l in lotes_por_vencer],
        'ultimos_pedidos': [p.to_dict() for p in ultimos_pedidos],
    })
