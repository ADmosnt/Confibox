import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  getAlmacenZonas, createAlmacenZona, updateAlmacenZona, deleteAlmacenZona,
  getUbicaciones, createUbicacion, updateUbicacion, deleteUbicacion,
  getAlmacenStock,
} from '../api'

const slotKey = (ubicacionId, nivel) => `${ubicacionId}:${nivel ?? 0}`

export function useAlmacenData() {
  const [zonas, setZonas] = useState([])
  const [ubicaciones, setUbicaciones] = useState([])
  const [stock, setStock] = useState({ slots: {}, sin_ubicar: [] })
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    try {
      const [zR, uR, sR] = await Promise.all([getAlmacenZonas(), getUbicaciones(), getAlmacenStock()])
      setZonas(zR.data)
      setUbicaciones(uR.data)
      setStock(sR.data)
    } catch {
      toast.error('Error cargando el plano')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshStock = useCallback(async () => {
    try { setStock((await getAlmacenStock()).data) } catch {}
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Zonas ────────────────────────────────────────────────────────────────
  const addZona = async (payload) => {
    try {
      const r = await createAlmacenZona(payload)
      setZonas((z) => [...z, r.data])
      return r.data
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al crear zona')
    }
  }

  const patchZona = async (id, patch) => {
    // Optimistic update for drag — revert on error
    setZonas((zs) => zs.map((z) => z.id === id ? { ...z, ...patch } : z))
    try {
      const r = await updateAlmacenZona(id, patch)
      setZonas((zs) => zs.map((z) => z.id === id ? r.data : z))
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al guardar zona')
      loadAll()
    }
  }

  const removeZona = async (id) => {
    try {
      await deleteAlmacenZona(id)
      setZonas((zs) => zs.filter((z) => z.id !== id))
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al eliminar zona')
    }
  }

  // ── Ubicaciones ──────────────────────────────────────────────────────────
  const addUbicacion = async (payload) => {
    try {
      const r = await createUbicacion(payload)
      setUbicaciones((u) => [...u, r.data])
      return r.data
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al crear ubicación')
    }
  }

  const patchUbicacion = async (id, patch) => {
    setUbicaciones((us) => us.map((u) => u.id === id ? { ...u, ...patch } : u))
    try {
      const r = await updateUbicacion(id, patch)
      setUbicaciones((us) => us.map((u) => u.id === id ? r.data : u))
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al guardar ubicación')
      loadAll()
    }
  }

  const removeUbicacion = async (id) => {
    try {
      await deleteUbicacion(id)
      setUbicaciones((us) => us.filter((u) => u.id !== id))
      refreshStock()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al eliminar ubicación')
    }
  }

  return {
    loading, zonas, ubicaciones, stock,
    loadAll, refreshStock,
    addZona, patchZona, removeZona,
    addUbicacion, patchUbicacion, removeUbicacion,
  }
}

export { slotKey }
