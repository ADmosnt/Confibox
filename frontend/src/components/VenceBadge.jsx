// Expiry date badge with color based on days remaining
export function VenceBadge({ fecha, showDate = true }) {
  if (!fecha) return <span className="text-gray-400 text-xs">Sin venc.</span>
  const dias = Math.ceil((new Date(fecha) - new Date()) / 86400000)
  if (dias <= 0)  return <span className="text-xs font-semibold text-white bg-red-600 px-1.5 py-0.5 rounded">Vencido</span>
  const suffix = showDate ? ` (${dias}d)` : ` · ${dias}d`
  if (dias <= 7)  return <span className="text-xs font-semibold text-red-600">{showDate ? fecha : ''}{suffix}</span>
  if (dias <= 15) return <span className="text-xs text-orange-500">{showDate ? fecha : ''}{suffix}</span>
  if (dias <= 30) return <span className="text-xs text-yellow-600">{showDate ? fecha : ''}{suffix}</span>
  return <span className="text-xs text-gray-500">{showDate ? fecha : `${dias}d`}</span>
}
