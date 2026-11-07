type LatLng = [number, number]

// Client-side cache so re-rendering the same profile doesn't re-fetch.
const cache = new Map<string, LatLng | null>()

export async function geocodePlace(place: string): Promise<LatLng | null> {
  const key = place.toLowerCase().trim()
  if (!key) return null
  if (cache.has(key)) return cache.get(key) ?? null

  try {
    const res = await fetch(`/api/geocode?place=${encodeURIComponent(key)}`)
    if (!res.ok) {
      cache.set(key, null)
      return null
    }
    const { coords } = await res.json()
    cache.set(key, coords ?? null)
    return coords ?? null
  } catch {
    cache.set(key, null)
    return null
  }
}
