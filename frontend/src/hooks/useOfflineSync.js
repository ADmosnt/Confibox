import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { syncOffline, uploadFile } from '../api'
import { loadPhoto, deletePhoto } from '../utils/photoStore'

const QUEUE_KEY = 'confibox_sync_queue'

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') }
  catch { return [] }
}

function saveQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

// Upload pending photo blobs and inject foto_evidencia_url into items
async function resolvePhotos(queue) {
  return Promise.all(
    queue.map(async (item) => {
      if (!item.fotoBlobKey) return item
      try {
        const blob = await loadPhoto(item.fotoBlobKey)
        if (!blob) return item
        const r = await uploadFile(blob)
        return { ...item, foto_evidencia_url: r.data.url }
      } catch {
        // Upload failed — send checkin without photo rather than block sync
        return item
      }
    })
  )
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [queue, setQueue] = useState(loadQueue)
  const [syncing, setSyncing] = useState(false)
  const syncingRef = useRef(false)

  useEffect(() => {
    saveQueue(queue)
  }, [queue])

  // Reads fresh from localStorage to avoid stale closure in event handlers
  async function doSync() {
    const q = loadQueue()
    if (!q.length || syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    try {
      const resolved = await resolvePhotos(q)
      const res = await syncOffline(resolved)
      const resultados = res.data.resultados ?? []
      const failedIds = resultados
        .filter((r) => !r.ok && !r.skipped)
        .map((r) => r.entrega_id)
      const okCount = resultados.filter((r) => r.ok || r.skipped).length

      // Clean up IndexedDB blobs for successfully synced items
      for (const item of q) {
        if (item.fotoBlobKey) {
          const result = resultados.find((r) => r.entrega_id === item.entrega_id)
          if (result?.ok || result?.skipped) {
            await deletePhoto(item.fotoBlobKey).catch(() => {})
          }
        }
      }

      setQueue((prev) =>
        failedIds.length > 0
          ? prev.filter((item) => failedIds.includes(item.entrega_id))
          : []
      )
      if (okCount > 0) {
        toast.success(
          `${okCount} entrega${okCount !== 1 ? 's' : ''} sincronizada${okCount !== 1 ? 's' : ''}`
        )
      }
    } catch {
      toast.error('Error al sincronizar — intentá de nuevo')
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); doSync() }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  function enqueue(item) {
    const entry = {
      entrega_id: item.entrega_id,
      estado: item.estado,
      latitud: item.latitud ?? null,
      longitud: item.longitud ?? null,
      motivo_incidencia: item.motivo_incidencia ?? null,
      observacion: item.observacion ?? null,
      hora_local: new Date().toISOString(),
      fotoBlobKey: item.fotoBlobKey ?? null,
    }
    // Write synchronously to localStorage so doSync always reads latest
    setQueue((q) => {
      const next = [...q, entry]
      saveQueue(next)
      return next
    })
  }

  return { isOnline, queue, enqueue, syncNow: doSync, syncing }
}
