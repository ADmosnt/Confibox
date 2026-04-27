import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import {
  getAlmacenZonas, createAlmacenZona, updateAlmacenZona, deleteAlmacenZona,
  getUbicaciones, createUbicacion, updateUbicacion, deleteUbicacion,
  getAlmacenStock,
} from '../api'

// ── Data store: single source of truth for warehouse entities ─────────────────
//
// Components subscribe to slices via selectors. Optimistic updates mutate the
// targeted entity in-place (immutable swap of the affected object only) so
// unaffected entities keep stable references and Zustand bails out their renders.

export const useDataStore = create((set, get) => ({
  zonas: [],
  ubicaciones: [],
  stock: { slots: {}, sin_ubicar: [] },
  loading: true,

  loadAll: async () => {
    set({ loading: true })
    try {
      const [zR, uR, sR] = await Promise.all([getAlmacenZonas(), getUbicaciones(), getAlmacenStock()])
      set({ zonas: zR.data, ubicaciones: uR.data, stock: sR.data, loading: false })
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
}))

// ── Canvas store: pure UI state (selection, mode, camera) ─────────────────────
// Strict separation from data — re-rendering canvas chrome doesn't touch entities.

export const useCanvasStore = create((set) => ({
  editMode: false,
  // selection: null | { type: 'zona'|'ubicacion', id, nivel? }
  selection: null,
  setEditMode: (v) => set({ editMode: typeof v === 'function' ? v({ editMode: false }) : v }),
  toggleEditMode: () => set((s) => ({ editMode: !s.editMode, selection: null })),
  setSelection: (s) => set({ selection: s }),
  selectZona: (id) => set({ selection: { type: 'zona', id } }),
  selectUbicacion: (id, nivel = null) => set({ selection: { type: 'ubicacion', id, nivel } }),
  clearSelection: () => set({ selection: null }),
}))

// ── Selector helpers (memoized derived data) ──────────────────────────────────
export const placedUbicacionIdsSelector = (s) =>
  s.ubicaciones.filter((u) => u.x != null).map((u) => u.id)
export const unplacedUbicacionesSelector = (s) =>
  s.ubicaciones.filter((u) => u.x == null)
export const zonaIdsSelector = (s) => s.zonas.map((z) => z.id)

export { useShallow }
