import { normalizeName } from '@/lib/canonical'

const TICKETMASTER_SUGGEST_URL = 'https://app.ticketmaster.com/discovery/v2/suggest.json'
const TICKETMASTER_VENUES_URL = 'https://app.ticketmaster.com/discovery/v2/venues.json'

export type ExternalSearchType = 'artist' | 'venue' | 'event' | 'city'

export type ExternalSearchResult = {
  id: string
  externalId?: string
  name: string
  subtitle?: string
  source: 'ticketmaster'
  eventName?: string
  artistName?: string
  artistExternalId?: string
  venueName?: string
  venueExternalId?: string
  city?: string
  date?: string
}

type TicketmasterImage = {
  url?: string
  ratio?: string
  width?: number
  height?: number
}

type TicketmasterAttraction = {
  id?: string
  name?: string
  images?: TicketmasterImage[]
  classifications?: TicketmasterClassification[]
}

type TicketmasterVenue = {
  id?: string
  name?: string
  city?: { name?: string }
  state?: { stateCode?: string; name?: string }
  country?: { countryCode?: string; name?: string }
}

type TicketmasterEvent = {
  id?: string
  name?: string
  classifications?: TicketmasterClassification[]
  dates?: {
    start?: {
      localDate?: string
    }
  }
  _embedded?: {
    attractions?: TicketmasterAttraction[]
    venues?: TicketmasterVenue[]
  }
}

type TicketmasterClassification = {
  segment?: {
    name?: string
  }
}

type TicketmasterSuggestResponse = {
  _embedded?: {
    attractions?: TicketmasterAttraction[]
    venues?: TicketmasterVenue[]
    events?: TicketmasterEvent[]
  }
}

export async function searchTicketmaster(
  type: ExternalSearchType,
  query: string,
  city?: string,
  limit = 6
): Promise<ExternalSearchResult[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY
  const keyword = query.trim()

  if (!apiKey || keyword.length < 2) return []

  if (type === 'city') {
    return searchTicketmasterCities(apiKey, keyword, limit)
  }

  const url = new URL(TICKETMASTER_SUGGEST_URL)
  url.searchParams.set('apikey', apiKey)
  url.searchParams.set('keyword', keyword)
  url.searchParams.set('countryCode', 'US')
  url.searchParams.set('segmentName', 'Music')
  url.searchParams.set('classificationName', 'music')
  if (city?.trim()) url.searchParams.set('city', city.trim())

  const response = await fetch(url, {
    next: { revalidate: 60 * 60 * 24 },
  })

  if (!response.ok) {
    throw new Error(`Ticketmaster search failed with ${response.status}`)
  }

  const data = await response.json() as TicketmasterSuggestResponse
  const embedded = data._embedded || {}

  if (type === 'artist') {
    return dedupeExternal(
      (embedded.attractions || [])
        .filter((artist) => artist.name)
        .filter(isMusicResult)
        .map((artist) => ({
          id: externalId('artist', artist.id, artist.name),
          externalId: artist.id,
          name: artist.name!,
          subtitle: 'Ticketmaster artist',
          source: 'ticketmaster' as const,
          artistName: artist.name!,
          artistExternalId: artist.id,
        }))
    ).slice(0, limit)
  }

  if (type === 'venue') {
    return dedupeExternal(
      (embedded.venues || [])
        .filter((venue) => venue.name)
        .map((venue) => ({
          id: externalId('venue', venue.id, venue.name),
          externalId: venue.id,
          name: venue.name!,
          subtitle: venueSubtitle(venue),
          source: 'ticketmaster' as const,
          venueName: venue.name!,
          venueExternalId: venue.id,
          city: venue.city?.name,
        }))
    ).slice(0, limit)
  }

  return dedupeExternal(
    (embedded.events || [])
      .filter((event) => event.name)
      .filter(isMusicResult)
      .map((event) => {
        const artist = event._embedded?.attractions?.[0]
        const venue = event._embedded?.venues?.[0]

        return {
          id: externalId('event', event.id, event.name),
          externalId: event.id,
          name: event.name!,
          subtitle: [artist?.name, venue?.name, event.dates?.start?.localDate].filter(Boolean).join(' · '),
          source: 'ticketmaster' as const,
          eventName: event.name!,
          artistName: artist?.name,
          artistExternalId: artist?.id,
          venueName: venue?.name,
          venueExternalId: venue?.id,
          city: venue?.city?.name,
          date: event.dates?.start?.localDate,
        }
      })
  ).slice(0, limit)
}

async function searchTicketmasterCities(apiKey: string, query: string, limit: number) {
  const url = new URL(TICKETMASTER_VENUES_URL)
  url.searchParams.set('apikey', apiKey)
  url.searchParams.set('city', query)
  url.searchParams.set('countryCode', 'US')
  url.searchParams.set('size', '20')

  const response = await fetch(url, {
    next: { revalidate: 60 * 60 * 24 },
  })

  if (!response.ok) {
    throw new Error(`Ticketmaster city search failed with ${response.status}`)
  }

  const data = await response.json() as { _embedded?: { venues?: TicketmasterVenue[] } }
  const venues = data._embedded?.venues || []

  return dedupeExternal(
    venues
      .filter((venue) => venue.city?.name)
      .map((venue) => ({
        id: externalId('city', undefined, venue.city!.name),
        name: venue.city!.name!,
        subtitle: [venue.state?.stateCode || venue.state?.name, venue.country?.countryCode].filter(Boolean).join(', '),
        source: 'ticketmaster' as const,
        city: venue.city!.name!,
      }))
  ).slice(0, limit)
}

function venueSubtitle(venue: TicketmasterVenue) {
  return [
    venue.city?.name,
    venue.state?.stateCode || venue.state?.name,
    venue.country?.countryCode,
  ].filter(Boolean).join(', ')
}

function externalId(type: ExternalSearchType, id?: string, name?: string) {
  return `ticketmaster:${type}:${id || normalizeName(name || '')}`
}

function isMusicResult(result: { classifications?: TicketmasterClassification[] }) {
  return (result.classifications || []).some((classification) =>
    classification.segment?.name?.toLowerCase() === 'music'
  )
}

function dedupeExternal(results: ExternalSearchResult[]) {
  const seen = new Set<string>()
  return results.filter((result) => {
    const key = normalizeName([result.name, result.subtitle].filter(Boolean).join(' '))
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
