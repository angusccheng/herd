import { NextRequest, NextResponse } from 'next/server'
import { searchTicketmaster } from '@/lib/ticketmaster'
import { searchSpotifyArtists } from '@/lib/spotify'
import { searchSetlistEvents } from '@/lib/setlistfm'

type SearchType = 'artist' | 'venue' | 'event' | 'city'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const type = searchParams.get('type') as SearchType | null
  const query = searchParams.get('q') || ''
  const city = searchParams.get('city') || ''

  if (type !== 'artist' && type !== 'venue' && type !== 'event' && type !== 'city') {
    return NextResponse.json({ error: 'Invalid search type' }, { status: 400 })
  }

  try {
    const results = await searchExternal(type, query, city, 8)

    return NextResponse.json({
      results,
      providers: {
        spotifyConfigured: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
        setlistfmConfigured: Boolean(process.env.SETLISTFM_API_KEY),
        ticketmasterConfigured: Boolean(process.env.TICKETMASTER_API_KEY),
      },
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Search failed',
    }, { status: 500 })
  }
}

async function searchExternal(type: SearchType, query: string, city: string, limit: number) {
  if (type === 'artist') {
    const [spotifyResults, ticketmasterResults] = await Promise.all([
      searchSpotifyArtists(query, limit),
      searchTicketmaster(type, query, city, limit),
    ])

    return dedupeResults([...spotifyResults, ...ticketmasterResults]).slice(0, limit)
  }

  if (type === 'event') {
    const [setlistResults, ticketmasterResults] = await Promise.all([
      searchSetlistEvents(query, city, limit),
      searchTicketmaster(type, query, city, limit),
    ])

    return dedupeResults([...setlistResults, ...ticketmasterResults]).slice(0, limit)
  }

  return searchTicketmaster(type, query, city, limit)
}

function dedupeResults<T extends { name: string; subtitle?: string }>(results: T[]) {
  const seen = new Set<string>()
  return results.filter((result) => {
    const key = `${result.name.toLowerCase()}|${(result.subtitle || '').toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
