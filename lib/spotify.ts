import { normalizeName } from '@/lib/canonical'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search'

type SpotifyTokenResponse = {
  access_token?: string
}

type SpotifyArtist = {
  id: string
  name: string
  genres?: string[]
  popularity?: number
}

type SpotifySearchResponse = {
  artists?: {
    items?: SpotifyArtist[]
  }
}

export type SpotifyArtistResult = {
  id: string
  externalId: string
  name: string
  subtitle?: string
  source: 'spotify'
  artistName: string
  artistExternalId: string
  artistExternalSource: 'spotify'
  genres: string[]
}

let cachedToken: { token: string; expiresAt: number } | null = null

export async function searchSpotifyArtists(query: string, limit = 6): Promise<SpotifyArtistResult[]> {
  const keyword = query.trim()
  if (keyword.length < 2) return []

  const token = await getSpotifyToken()
  if (!token) return []

  const url = new URL(SPOTIFY_SEARCH_URL)
  url.searchParams.set('q', keyword)
  url.searchParams.set('type', 'artist')
  url.searchParams.set('market', 'US')
  url.searchParams.set('limit', String(limit))

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    next: { revalidate: 60 * 60 * 24 },
  })

  if (!response.ok) {
    throw new Error(`Spotify search failed with ${response.status}`)
  }

  const data = await response.json() as SpotifySearchResponse

  return dedupeSpotifyArtists(
    (data.artists?.items || []).map((artist) => ({
      id: `spotify:artist:${artist.id}`,
      externalId: artist.id,
      name: artist.name,
      subtitle: artist.genres?.slice(0, 2).join(', ') || undefined,
      source: 'spotify' as const,
      artistName: artist.name,
      artistExternalId: artist.id,
      artistExternalSource: 'spotify' as const,
      genres: artist.genres || [],
    }))
  ).slice(0, limit)
}

async function getSpotifyToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })

  if (!response.ok) {
    throw new Error(`Spotify token request failed with ${response.status}`)
  }

  const data = await response.json() as SpotifyTokenResponse
  if (!data.access_token) return null

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  }

  return cachedToken.token
}

function dedupeSpotifyArtists(results: SpotifyArtistResult[]) {
  const seen = new Set<string>()
  return results.filter((result) => {
    const key = normalizeName(result.name)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
