'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SENTIMENT_BUCKETS, SentimentBucket } from '@/lib/ranking'

const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000001'

const SENTIMENT_COLORS: Record<SentimentBucket, string> = {
  liked: 'var(--good)',
  fine: 'var(--okay)',
  didnt: 'var(--bad)',
}

type CanonicalSearchType = 'artist' | 'venue' | 'event' | 'city'
type CanonicalSearchResult = {
  id: string
  externalId?: string
  name: string
  subtitle?: string
  source: 'ticketmaster' | 'spotify' | 'setlistfm'
  eventName?: string
  artistName?: string
  artistExternalId?: string
  artistExternalSource?: string
  venueName?: string
  venueExternalId?: string
  venueExternalSource?: string
  city?: string
  date?: string
  genres?: string[]
}

export default function AddConcertPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sentiment, setSentiment] = useState<SentimentBucket | null>(null)

  const [form, setForm] = useState({
    event_name: '',
    artist_name: '',
    venue_name: '',
    city: '',
    date: '',
    notes: '',
    genres: [] as string[],
    event_external_id: '',
    event_external_source: '',
    artist_external_id: '',
    artist_external_source: '',
    venue_external_id: '',
    venue_external_source: '',
  })

  const today = new Date().toISOString().split('T')[0]

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!form.artist_name.trim()) {
      setError('Artist is required')
      setLoading(false)
      return
    }

    if (!form.artist_external_id) {
      setError('Choose an artist from the suggestions')
      setLoading(false)
      return
    }

    if (form.venue_name.trim() && !form.venue_external_id) {
      setError('Choose a venue from the suggestions')
      setLoading(false)
      return
    }

    if (form.date && form.date > today) {
      setError('You can only review concerts that already happened')
      setLoading(false)
      return
    }

    if (!sentiment) {
      setError('Pick how the show landed before ranking it')
      setLoading(false)
      return
    }

    const externalPayload = {
      user_id: PLACEHOLDER_USER_ID,
      event_external_id: form.event_external_id || null,
      event_external_source: form.event_external_source || null,
      artist_external_id: form.artist_external_id || null,
      artist_external_source: form.artist_external_source || null,
      venue_external_id: form.venue_external_id || null,
      venue_external_source: form.venue_external_source || null,
      ticketmaster_event_id: form.event_external_source === 'ticketmaster' ? form.event_external_id : null,
      ticketmaster_artist_id: form.artist_external_source === 'ticketmaster' ? form.artist_external_id : null,
      ticketmaster_venue_id: form.venue_external_source === 'ticketmaster' ? form.venue_external_id : null,
      event_name: form.event_name.trim() || null,
      artist_name: form.artist_name.trim(),
      venue_name: form.venue_name.trim() || null,
      city: form.city.trim() || null,
      date: form.date || null,
      notes: form.notes.trim() || null,
      genres: form.genres,
      elo_score: SENTIMENT_BUCKETS[sentiment].score,
    }

    const legacyPayload = {
      user_id: PLACEHOLDER_USER_ID,
      artist_name: externalPayload.artist_name,
      venue_name: externalPayload.venue_name,
      city: externalPayload.city,
      date: externalPayload.date,
      notes: buildNotes(externalPayload.event_name || '', form.notes),
      genres: externalPayload.genres,
      elo_score: externalPayload.elo_score,
    }

    const { data, error: insertError } = await insertConcert(externalPayload, legacyPayload)

    if (insertError || !data) {
      setError(insertError?.message || 'Something went wrong')
      setLoading(false)
      return
    }

    router.push(`/compare?new=${data.id}&bucket=${sentiment}`)
  }

  return (
    <main className="app-shell">
      <div className="form-shell">
        <div className="page-topbar">
          <div>
            <Link className="button secondary" href="/">
              Back
            </Link>
          </div>
        </div>

        <div className="brand-lockup" style={{ marginBottom: 24 }}>
          <h1 className="page-title">Log a show</h1>
        </div>

        <form onSubmit={handleSubmit} className="panel form-section">
          <div className="field">
            <span className="label">How did it land?</span>
            <div className="sentiment-list" role="radiogroup" aria-label="Show sentiment">
              {(Object.keys(SENTIMENT_BUCKETS) as SentimentBucket[]).map((bucket) => {
                const config = SENTIMENT_BUCKETS[bucket]
                const active = sentiment === bucket

                return (
                  <button
                    className={`sentiment-card ${active ? 'active' : ''}`}
                    key={bucket}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSentiment(bucket)}
                    style={{ color: SENTIMENT_COLORS[bucket] }}
                  >
                    <span className="sentiment-dot" />
                    <span className="sentiment-label">{config.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {sentiment && (
            <>
              <div className="form-grid">
                <CanonicalSearchInput
                  label="Artist"
                  type="artist"
                  value={form.artist_name}
                  required
                  onChange={(value) => setForm(prev => ({
                    ...prev,
                    artist_name: value,
                    artist_external_id: '',
                    artist_external_source: '',
                    genres: [],
                  }))}
                  onSelectResult={(result) => {
                    setForm(prev => ({
                      ...prev,
                      artist_name: result.artistName || result.name,
                      artist_external_id: result.artistExternalId || result.externalId || '',
                      artist_external_source: result.artistExternalSource || result.source,
                      genres: result.genres || [],
                    }))
                  }}
                  onBlur={() => setForm(prev => ({ ...prev, artist_name: prev.artist_name.trim() }))}
                />

                <CanonicalSearchInput
                  label="Venue"
                  type="venue"
                  value={form.venue_name}
                  city={form.city}
                  onChange={(value) => setForm(prev => ({
                    ...prev,
                    venue_name: value,
                    venue_external_id: '',
                    venue_external_source: '',
                  }))}
                  onSelectResult={(result) => {
                    setForm(prev => ({
                      ...prev,
                      venue_name: result.venueName || result.name,
                      city: result.city || prev.city,
                      venue_external_id: result.venueExternalId || result.externalId || '',
                      venue_external_source: result.venueExternalSource || result.source,
                    }))
                  }}
                  onBlur={() => setForm(prev => ({ ...prev, venue_name: prev.venue_name.trim() }))}
                />

                <CanonicalSearchInput
                  label="City"
                  type="city"
                  value={form.city}
                  onChange={(value) => setForm(prev => ({ ...prev, city: value }))}
                  onSelectResult={(result) => {
                    setForm(prev => ({
                      ...prev,
                      city: result.city || result.name,
                    }))
                  }}
                  onBlur={() => setForm(prev => ({ ...prev, city: prev.city.trim() }))}
                />

                <div className="field full">
                  <label className="label" htmlFor="date">Date</label>
                  <input className="input" id="date" name="date" value={form.date} onChange={handleChange} type="date" max={today} />
                </div>

                <div className="field full">
                  <label className="label" htmlFor="event_name">Tour / event name</label>
                  <input
                    className="input"
                    id="event_name"
                    name="event_name"
                    value={form.event_name}
                    onChange={(event) => setForm(prev => ({
                      ...prev,
                      event_name: event.target.value,
                      event_external_id: '',
                      event_external_source: '',
                    }))}
                    onBlur={() => setForm(prev => ({ ...prev, event_name: prev.event_name.trim() }))}
                  />
                </div>

                <div className="field full">
                  <label className="label" htmlFor="notes">Notes</label>
                  <textarea
                    className="input"
                    id="notes"
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    rows={4}
                  />
                </div>
              </div>

              <button className="button" type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save and rank'}
              </button>
            </>
          )}

          {error && <div className="error-box">{error}</div>}
        </form>
      </div>
    </main>
  )
}

function buildNotes(eventName: string, notes: string) {
  const cleanEvent = eventName.trim()
  const cleanNotes = notes.trim()

  if (!cleanEvent) return cleanNotes || null
  return [`Event: ${cleanEvent}`, cleanNotes].filter(Boolean).join('\n\n')
}

async function insertConcert(externalPayload: Record<string, unknown>, legacyPayload: Record<string, unknown>) {
  const externalInsert = await supabase
    .from('concerts')
    .insert(externalPayload)
    .select()
    .single()

  if (!externalInsert.error) return externalInsert

  const missingExternalColumn = /event_external_id|event_external_source|artist_external_id|artist_external_source|venue_external_id|venue_external_source|ticketmaster_event_id|ticketmaster_artist_id|ticketmaster_venue_id|event_name|schema cache|column/i.test(externalInsert.error.message)
  if (!missingExternalColumn) return externalInsert

  return supabase
    .from('concerts')
    .insert(legacyPayload)
    .select()
    .single()
}

function CanonicalSearchInput({
  label,
  type,
  value,
  placeholder,
  city,
  required,
  onChange,
  onSelectResult,
  onBlur,
}: {
  label: string
  type: CanonicalSearchType
  value: string
  placeholder?: string
  city?: string
  required?: boolean
  onChange: (value: string) => void
  onSelectResult?: (result: CanonicalSearchResult) => void
  onBlur: () => void
}) {
  const [results, setResults] = useState<CanonicalSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)

      try {
        const params = new URLSearchParams({
          type,
          q: value,
        })
        if (city) params.set('city', city)

        const res = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        })
        const data = await res.json()
        setResults(data.results || [])
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 180)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [city, open, type, value])

  function handleSelect(result: CanonicalSearchResult) {
    if (onSelectResult) {
      onSelectResult(result)
    } else {
      onChange(result.name)
    }
    setOpen(false)
  }

  return (
    <div className="field canonical-field">
      <label className="label" htmlFor={`${type}_name`}>{label}</label>
      <input
        className="input"
        id={`${type}_name`}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false)
            onBlur()
          }, 120)
        }}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${type}_results`}
      />

      {open && (
        <div className="canonical-menu" id={`${type}_results`} role="listbox">
          {loading && <div className="canonical-empty">Searching...</div>}
          {!loading && results.map(result => (
            <button
              className="canonical-option"
              key={result.id}
              type="button"
              role="option"
              aria-selected="false"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(result)}
            >
              <span>
                <strong>{result.name}</strong>
                {result.subtitle && <small>{result.subtitle}</small>}
              </span>
            </button>
          ))}
          {!loading && results.length === 0 && value.trim().length === 0 && (
            <div className="canonical-empty">Start typing to search</div>
          )}
        </div>
      )}
    </div>
  )
}
