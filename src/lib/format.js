/**
 * Formatting helpers shared across pages. Centralized so "N/A" / "—"
 * conventions for missing data stay consistent everywhere.
 */

export function formatRelativeTime(isoString) {
  if (!isoString) return 'N/A'
  const then = new Date(isoString).getTime()
  if (Number.isNaN(then)) return 'N/A'
  const diffMs = Date.now() - then
  const diffSec = Math.round(diffMs / 1000)

  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec} sec ago`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}

export function formatClockTime(isoString) {
  if (!isoString) return 'N/A'
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return 'N/A'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatFuel(fuelLevel) {
  if (fuelLevel === null || fuelLevel === undefined) return null
  return `${Math.round(fuelLevel)}%`
}

export function formatSpeed(speedKmph) {
  if (speedKmph === null || speedKmph === undefined) return 'N/A'
  return `${Math.round(speedKmph)} km/h`
}

export function formatDistance(distanceCm) {
  if (distanceCm === null || distanceCm === undefined) return 'N/A'
  return `${Number(distanceCm).toFixed(1)} cm`
}

export function formatCoords(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return 'N/A'
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}
