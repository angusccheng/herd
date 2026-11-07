import { NextRequest, NextResponse } from 'next/server'

type LatLng = [number, number]

// Process-lifetime cache so repeated requests for the same place don't re-hit Nominatim.
const cache = new Map<string, LatLng | null>()

// Nominatim's usage policy caps requests at 1/sec, so outgoing calls are serialized
// behind this chain regardless of how many concurrent requests this route receives.
let queue: Promise<void> = Promise.resolve()
const MIN_INTERVAL_MS = 1100

async function throttledFetch(place: string): Promise<LatLng | null> {
  const result = queue.then(async () => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'herd-app (concert tracker; contact via app owner)',
      },
    })
    const data = await res.json()
    if (!Array.isArray(data) || !data[0]) return null
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)] as LatLng
  })

  queue = result.then(
    () => new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS)),
    () => new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS))
  )

  return result
}

export async function GET(req: NextRequest) {
  const place = req.nextUrl.searchParams.get('place')?.trim()
  if (!place) {
    return NextResponse.json({ error: 'Missing place' }, { status: 400 })
  }

  const key = place.toLowerCase()
  if (cache.has(key)) {
    return NextResponse.json({ coords: cache.get(key) ?? null })
  }

  const coords = await throttledFetch(place)
  cache.set(key, coords)

  return NextResponse.json({ coords })
}
