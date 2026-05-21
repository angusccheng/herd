import { normalizeName } from '@/lib/canonical'

const SETLISTFM_SEARCH_URL = 'https://api.setlist.fm/rest/1.0/search/setlists'

export type SetlistSearchResult = {
  id: string
  externalId: string
  name: string
  subtitle?: string
  source: 'setlistfm'
  eventName: string
  artistName?: string
  artistExternalId?: string
  artistExternalSource?: 'musicbrainz'
  venueName?: string
  venueExternalId?: string
  venueExternalSource?: 'setlistfm'
  city?: string
  date?: string
}

type SetlistResponse = {
  setlist?: SetlistItem[] | SetlistItem
}

type SetlistItem = {
  id?: string
  eventDate?: string
  artist?: {
    name?: string
    mbid?: string
  }
  venue?: {
    id?: string
    name?: string
    city?: {
      name?: string
      stateCode?: string
      country?: {
        code?: string
      }
    }
  }
}

export async function searchSetlistEvents(
  query: string,
  city?: string,
  limit = 6
): Promise<SetlistSearchResult[]> {
  const apiKey = process.env.SETLISTFM_API_KEY
  const keyword = query.trim()
  if (!apiKey || keyword.length < 2) return []

  const url = new URL(SETLISTFM_SEARCH_URL)
  url.searchParams.set('artistName', keyword)
  url.searchParams.set('p', '1')
  if (city?.trim()) url.searchParams.set('cityName', city.trim())

  const response = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
      Accept: 'application/json',
    },
    next: { revalidate: 60 * 60 * 24 },
  })

  if (response.status === 404) return []

  if (!response.ok) {
    throw new Error(`setlist.fm search failed with ${response.status}`)
  }

  const data = await response.json() as SetlistResponse
  const setlists = Array.isArray(data.setlist)
    ? data.setlist
    : data.setlist
      ? [data.setlist]
      : []

  return dedupeSetlists(
    setlists.flatMap((setlist) => {
      if (!setlist.id || !setlist.artist?.name) return []

      const date = normalizeSetlistDate(setlist.eventDate)
      const venue = setlist.venue
      const cityName = venue?.city?.name
      const displayName = `${setlist.artist.name}${venue?.name ? ` at ${venue.name}` : ''}`

      return [{
        id: `setlistfm:event:${setlist.id}`,
        externalId: setlist.id,
        name: displayName,
        subtitle: [venue?.name, cityName, date].filter(Boolean).join(' · '),
        source: 'setlistfm' as const,
        eventName: displayName,
        artistName: setlist.artist.name,
        artistExternalId: setlist.artist.mbid,
        artistExternalSource: setlist.artist.mbid ? 'musicbrainz' as const : undefined,
        venueName: venue?.name,
        venueExternalId: venue?.id,
        venueExternalSource: venue?.id ? 'setlistfm' as const : undefined,
        city: cityName,
        date,
      }]
    })
  ).slice(0, limit)
}

function normalizeSetlistDate(date?: string) {
  if (!date) return undefined
  const [day, month, year] = date.split('-')
  if (!day || !month || !year) return undefined
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function dedupeSetlists(results: SetlistSearchResult[]) {
  const seen = new Set<string>()
  return results.filter((result) => {
    const key = normalizeName([result.artistName, result.venueName, result.date].filter(Boolean).join(' '))
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
