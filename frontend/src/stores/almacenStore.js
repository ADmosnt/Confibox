import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import {
  getAlmacenZonas, createAlmacenZona, updateAlmacenZona, deleteAlmacenZona,
  getUbicaciones, createUbicacion, updateUbicacion, deleteUbicacion,
  getAlmacenStock,
  getEtiquetas, createEtiqueta, deleteEtiqueta, assignEtiqueta, unassignEtiqueta,
  cambiarEstadoLote,
} from '../api'

// ── Data store: single source of truth for warehouse entities ─────────────────

export const useDataStore = create((set, get) => ({
  zonas: [],
  ubicaciones: [],
  stock: { slots: {}, sin_ubicar: [] },
  etiquetas: [],
  loading: true,

  loadAll: async () => {
    set({ loading: true })
    try {
      const [zR, uR, sR, eR] = await Promise.all([
        getAlmacenZonas(), getUbicaciones(), getAlmacenStock(), getEtiquetas(),
      ])
      set({ zonas: zR.data, ubicaciones: uR.data, stock: sR.data, etiquetas: eR.data, loading: false })
    } catch {
      toast.error('Error cargando el plano')
      set({ loading: false })
    }
  },

  refreshStock: async () => {
    try { set({ stock: (await getAlmacenStock()).data }) } catch {}
  },

  // ── Zonas ─────────────────────────────────────────────
  addZona: async (payload) => {
    try {
      const r = await createAlmacenZona(payload)
      set((s) => ({ zonas: [...s.zonas, r.data] }))
      return r.data
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al crear zona')
    }
  },

  patchZona: async (id, patch) => {
    const prev = get().zonas.find((z) => z.id === id)
    if (!prev) return
    set((s) => ({ zonas: s.zonas.map((z) => z.id === id ? { ...z, ...patch } : z) }))
    try {
      const r = await updateAlmacenZona(id, patch)
      set((s) => ({ zonas: s.zonas.map((z) => z.id === id ? r.data : z) }))
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al guardar zona')
      set((s) => ({ zonas: s.zonas.map((z) => z.id === id ? prev : z) }))
    }
  },

  removeZona: async (id) => {
    try {
      await deleteAlmacenZona(id)
      set((s) => ({ zonas: s.zonas.filter((z) => z.id !== id) }))
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al eliminar zona')
    }
  },

  // ── Ubicaciones ────────────────────────────────────────
  addUbicacion: async (payload) => {
    try {
      const r = await createUbicacion(payload)
      set((s) => ({ ubicaciones: [...s.ubicaciones, r.data] }))
      return r.data
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al crear ubicación')
    }
  },

  patchUbicacion: async (id, patch) => {
    const prev = get().ubicaciones.find((u) => u.id === id)
    if (!prev) return
    set((s) => ({ ubicaciones: s.ubicaciones.map((u) => u.id === id ? { ...u, ...patch } : u) }))
    try {
      const r = await updateUbicacion(id, patch)
      set((s) => ({ ubicaciones: s.ubicaciones.map((u) => u.id === id ? r.data : u) }))
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al guardar ubicación')
      set((s) => ({ ubicaciones: s.ubicaciones.map((u) => u.id === id ? prev : u) }))
    }
  },

  removeUbicacion: async (id) => {
    try {
      await deleteUbicacion(id)
      set((s) => ({ ubicaciones: s.ubicaciones.filter((u) => u.id !== id) }))
      get().refreshStock()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al eliminar ubicación')
    }
  },

  // ── Etiquetas ──────────────────────────────────────────
  addEtiqueta: async (payload) => {
    try {
      const r = await createEtiqueta(payload)
      set((s) => ({ etiquetas: [...s.etiquetas, r.data] }))
      return r.data
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al crear etiqueta')
    }
  },

  removeEtiqueta: async (id) => {
    try {
      await deleteEtiqueta(id)
      set((s) => ({ etiquetas: s.etiquetas.filter((e) => e.id !== id) }))
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al eliminar etiqueta')
    }
  },

  assignEtiquetaToUbicacion: async (ubicacionId, etiquetaId) => {
    try {
      const r = await assignEtiqueta(ubicacionId, etiquetaId)
      set((s) => ({ ubicaciones: s.ubicaciones.map((u) => u.id === ubicacionId ? r.data : u) }))
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al asignar etiqueta')
    }
  },

  unassignEtiquetaFromUbicacion: async (ubicacionId, etiquetaId) => {
    try {
      const r = await unassignEtiqueta(ubicacionId, etiquetaId)
      set((s) => ({ ubicaciones: s.ubicaciones.map((u) => u.id === ubicacionId ? r.data : u) }))
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al quitar etiqueta')
    }
  },

  // ── Lote estado ────────────────────────────────────────
  changeLoteEstado: async (loteId, nuevoEstado) => {
    try {
      const r = await cambiarEstadoLote(loteId, nuevoEstado)
      // Update lote in stock.slots and sin_ubicar
      set((s) => {
        const updateInList = (list) => list.map((l) => l.id === loteId ? r.data : l)
        const newSlots = {}
        for (const [k, lotes] of Object.entries(s.stock.slots)) {
          newSlots[k] = updateInList(lotes)
        }
        return {
          stock: {
            slots: newSlots,
            sin_ubicar: updateInList(s.stock.sin_ubicar),
          },
        }
      })
      toast.success(`Estado: ${nuevoEstado}`)
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Error al cambiar estado')
    }
  },
}))

// ── Canvas store: pure UI state (selection, mode, camera) ─────────────────────

export const useCanvasStore = create((set) => ({
  editMode: false,
  // selection: null | { type: 'zona'|'ubicacion', id, nivel? }
  selection: null,
  gridSize: 25,
  // 'normal' | 'heatmap' (occupation %) | 'fefo' (expiry urgency)
  viewMode: 'normal',
  setEditMode: (v) => set({ editMode: typeof v === 'function' ? v({ editMode: false }) : v }),
  toggleEditMode: () => set((s) => ({ editMode: !s.editMode, selection: null })),
  setSelection: (s) => set({ selection: s }),
  selectZona: (id) => set({ selection: { type: 'zona', id } }),
  selectUbicacion: (id, nivel = null) => set({ selection: { type: 'ubicacion', id, nivel } }),
  clearSelection: () => set({ selection: null }),
  setGridSize: (n) => set({ gridSize: n }),
  setViewMode: (m) => set({ viewMode: m }),
}))

// ── Selector helpers (memoized derived data) ──────────────────────────────────
export const placedUbicacionIdsSelector = (s) =>
  s.ubicaciones.filter((u) => u.x != null).map((u) => u.id)
export const unplacedUbicacionesSelector = (s) =>
  s.ubicaciones.filter((u) => u.x == null)
export const zonaIdsSelector = (s) => s.zonas.map((z) => z.id)

export { useShallow }
