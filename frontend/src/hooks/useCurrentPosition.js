import { useState, useCallback } from 'react'

export default function useCurrentPosition() {
  const [position, setPosition] = useState(null)   // { lat, lng }
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const getPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización.')
      return
    }
    setLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLoading(false)
      },
      (err) => {
        setError(err.message || 'No se pudo obtener la ubicación.')
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  return { position, error, loading, getPosition }
}
