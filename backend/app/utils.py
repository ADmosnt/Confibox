from decimal import Decimal

UNIDADES = [
    '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE',
    'DIECIOCHO', 'DIECINUEVE',
]
VEINTES = {
    20: 'VEINTE', 21: 'VEINTIUN', 22: 'VEINTIDOS', 23: 'VEINTITRES',
    24: 'VEINTICUATRO', 25: 'VEINTICINCO', 26: 'VEINTISEIS',
    27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE',
}
DECENAS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA',
           'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
            'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']


def _tres_digitos(n):
    if n == 0:
        return ''
    if n == 100:
        return 'CIEN'
    partes = []
    c = n // 100
    r = n % 100
    if c:
        partes.append(CENTENAS[c])
    if r == 0:
        pass
    elif r < 20:
        partes.append(UNIDADES[r])
    elif r in VEINTES:
        partes.append(VEINTES[r])
    else:
        dec = r // 10
        uni = r % 10
        if uni == 0:
            partes.append(DECENAS[dec])
        else:
            partes.append(f"{DECENAS[dec]} Y {UNIDADES[uni]}")
    return ' '.join(partes)


def _entero_a_letras(n):
    if n == 0:
        return 'CERO'
    partes = []
    millones = n // 1_000_000
    resto = n % 1_000_000
    if millones:
        partes.append('UN MILLON' if millones == 1 else f"{_tres_digitos(millones)} MILLONES")
    miles = resto // 1_000
    resto = resto % 1_000
    if miles:
        partes.append('MIL' if miles == 1 else f"{_tres_digitos(miles)} MIL")
    if resto:
        partes.append(_tres_digitos(resto))
    return ' '.join(partes)


def numero_a_letras(valor):
    """Convert a monetary decimal value to Spanish words."""
    if isinstance(valor, Decimal):
        valor = float(valor)
    entero = int(valor)
    decimales = round((valor - entero) * 100)
    return f"{_entero_a_letras(entero)} CON {decimales:02d}/100"


def siguiente_numero_pedido(db, _Pedido=None):
    """Generate next pedido number via a Postgres sequence (atomic, no race conditions)."""
    from sqlalchemy import text
    row = db.session.execute(text("SELECT nextval('seq_pedido_numero')")).fetchone()
    return str(row[0]).zfill(8)
