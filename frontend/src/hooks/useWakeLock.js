import { useEffect, useRef } from 'react'

export function useWakeLock(active = true) {
  const lockRef = useRef(null)

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let cancelled = false

    const acquire = () => {
      navigator.wakeLock.request('screen').then((lock) => {
        if (cancelled) { lock.release(); return }
        lockRef.current = lock
        lock.addEventListener('release', () => { lockRef.current = null })
      }).catch(() => {})
    }

    acquire()

    // Re-acquire after tab becomes visible again (browser releases lock on hide)
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !lockRef.current) acquire()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      lockRef.current?.release()
      lockRef.current = null
    }
  }, [active])
}
