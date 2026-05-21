import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizeName, titleCaseName } from '@/lib/canonical'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type CanonicalEntity = {
  id: string
  name: string
}

export async function POST(req: NextRequest) {
  const { artistName, venueName, eventName, city, date } = await req.json()

  try {
    const artist = await resolveArtist(artistName)
    const venue = await resolveVenue(venueName, city)
    const event = await resolveEvent(eventName, artist, venue, city, date)

    return NextResponse.json({
      artist,
      venue,
      event,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Could not resolve canonical records',
    }, { status: 500 })
  }
}

async function resolveArtist(name: string | null | undefined): Promise<CanonicalEntity | null> {
  const cleanName = typeof name === 'string' ? name.trim() : ''
  const normalized = normalizeName(cleanName)
  if (!normalized) return null

  const aliasMatch = await supabase
    .from('artist_aliases')
    .select('artist:artists(id, name)')
    .eq('normalized_alias', normalized)
    .maybeSingle()

  assertSupabaseOk(aliasMatch.error)

  if (aliasMatch.data?.artist) {
    const artist = Array.isArray(aliasMatch.data.artist) ? aliasMatch.data.artist[0] : aliasMatch.data.artist
    return artist
  }

  const directMatch = await supabase
    .from('artists')
    .select('id, name')
    .eq('normalized_name', normalized)
    .maybeSingle()

  assertSupabaseOk(directMatch.error)

  if (directMatch.data) return directMatch.data

  const inserted = await supabase
    .from('artists')
    .insert({
      name: preserveKnownCasing(cleanName),
      normalized_name: normalized,
    })
    .select('id, name')
    .single()

  if (inserted.error || !inserted.data) {
    throw new Error(inserted.error?.message || 'Could not create artist')
  }

  await supabase.from('artist_aliases').insert({
    artist_id: inserted.data.id,
    alias: cleanName,
    normalized_alias: normalized,
  })

  return inserted.data
}

async function resolveVenue(name: string | null | undefined, city: string | null | undefined): Promise<CanonicalEntity | null> {
  const cleanName = typeof name === 'string' ? name.trim() : ''
  const cleanCity = typeof city === 'string' ? city.trim() : ''
  const normalized = normalizeName(cleanName)
  const normalizedCity = normalizeName(cleanCity)
  if (!normalized) return null

  const aliasQuery = supabase
    .from('venue_aliases')
    .select('venue:venues(id, name)')
    .eq('normalized_alias', normalized)

  const aliasMatch = normalizedCity
    ? await aliasQuery.or(`normalized_city.eq.${normalizedCity},normalized_city.is.null`).limit(1).maybeSingle()
    : await aliasQuery.limit(1).maybeSingle()

  assertSupabaseOk(aliasMatch.error)

  if (aliasMatch.data?.venue) {
    const venue = Array.isArray(aliasMatch.data.venue) ? aliasMatch.data.venue[0] : aliasMatch.data.venue
    return venue
  }

  let directQuery = supabase
    .from('venues')
    .select('id, name')
    .eq('normalized_name', normalized)

  if (normalizedCity) {
    directQuery = directQuery.eq('normalized_city', normalizedCity)
  }

  const directMatch = await directQuery.limit(1).maybeSingle()
  assertSupabaseOk(directMatch.error)
  if (directMatch.data) return directMatch.data

  const inserted = await supabase
    .from('venues')
    .insert({
      name: titleCaseName(cleanName),
      normalized_name: normalized,
      city: cleanCity || null,
      normalized_city: normalizedCity || null,
    })
    .select('id, name')
    .single()

  if (inserted.error || !inserted.data) {
    throw new Error(inserted.error?.message || 'Could not create venue')
  }

  await supabase.from('venue_aliases').insert({
    venue_id: inserted.data.id,
    alias: cleanName,
    normalized_alias: normalized,
    normalized_city: normalizedCity || null,
  })

  return inserted.data
}

async function resolveEvent(
  name: string | null | undefined,
  artist: CanonicalEntity | null,
  venue: CanonicalEntity | null,
  city: string | null | undefined,
  date: string | null | undefined
): Promise<CanonicalEntity | null> {
  const cleanName = typeof name === 'string' ? name.trim() : ''
  const normalized = normalizeName(cleanName)
  if (!normalized && !artist && !venue && !date) return null

  const cleanCity = typeof city === 'string' ? city.trim() : ''
  const normalizedCity = normalizeName(cleanCity)
  const eventDate = typeof date === 'string' && date ? date : null

  let query = supabase
    .from('events')
    .select('id, name')
    .eq('artist_id', artist?.id || '')
    .eq('venue_id', venue?.id || '')

  if (eventDate) query = query.eq('event_date', eventDate)
  if (normalized) query = query.eq('normalized_name', normalized)

  const exactMatch = artist && venue
    ? await query.limit(1).maybeSingle()
    : { data: null }

  if ('error' in exactMatch) {
    assertSupabaseOk(exactMatch.error)
  }

  if (exactMatch.data) {
    return {
      id: exactMatch.data.id,
      name: exactMatch.data.name || cleanName || artist?.name || 'Untitled event',
    }
  }

  const displayName = cleanName || [artist?.name, venue?.name].filter(Boolean).join(' at ')

  const inserted = await supabase
    .from('events')
    .insert({
      name: displayName || null,
      normalized_name: normalizeName(displayName),
      artist_id: artist?.id || null,
      venue_id: venue?.id || null,
      event_date: eventDate,
      city: cleanCity || null,
      normalized_city: normalizedCity || null,
    })
    .select('id, name')
    .single()

  if (inserted.error || !inserted.data) {
    throw new Error(inserted.error?.message || 'Could not create event')
  }

  if (cleanName) {
    await supabase.from('event_aliases').insert({
      event_id: inserted.data.id,
      alias: cleanName,
      normalized_alias: normalized,
      artist_id: artist?.id || null,
      venue_id: venue?.id || null,
      event_date: eventDate,
    })
  }

  return {
    id: inserted.data.id,
    name: inserted.data.name || displayName,
  }
}

function preserveKnownCasing(value: string) {
  const trimmed = value.trim()
  if (/^[a-z0-9&]{2,5}$/i.test(trimmed)) return trimmed.toUpperCase()
  return titleCaseName(trimmed)
}

function assertSupabaseOk(error: { message?: string } | null) {
  if (error) {
    throw new Error(error.message || 'Supabase query failed')
  }
}
