'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, Concert } from '@/lib/supabase'
import { getConcertBucket, getRatingColor, getRatingDisplay } from '@/lib/ranking'

const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000001'

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function HomePage() {
  const [concerts, setConcerts] = useState<Concert[]>([])
  const [loading, setLoading] = useState(true)
  const bucketCounts = concerts.reduce<Record<string, number>>((counts, concert) => {
    const bucket = getConcertBucket(concert)
    counts[bucket] = (counts[bucket] || 0) + 1
    return counts
  }, {})

  useEffect(() => {
    async function fetchConcerts() {
      const { data, error } = await supabase
        .from('concerts')
        .select('*')
        .eq('user_id', PLACEHOLDER_USER_ID)
        .order('elo_score', { ascending: false })

      if (!error) setConcerts(data || [])
      setLoading(false)
    }

    fetchConcerts()
  }, [])

  return (
    <main className="app-shell">
      <div className="page-topbar">
        <div className="brand-lockup">
          <h1 className="brand-title">herd</h1>
          <p className="eyebrow">{concerts.length} shows ranked by your taste</p>
        </div>
      </div>

      {loading ? (
        <div className="panel empty-state">
          <p>Loading your shows...</p>
        </div>
      ) : concerts.length === 0 ? (
        <div className="panel empty-state">
          <h2>Start your concert ranking</h2>
          <Link className="button" href="/add">
            Log first show
          </Link>
        </div>
      ) : (
        <div className="surface-grid">
          <section className="panel rank-list" aria-label="Ranked concerts">
            {concerts.map((concert, index) => {
              const color = getRatingColor(concert.elo_score)
              const isBaseline = bucketCounts[getConcertBucket(concert)] === 1

              return (
                <Link
                  className="rank-row"
                  key={concert.id}
                  href={`/concert/${concert.id}`}
                >
                  <div className="rank-number">{index + 1}</div>
                  <div>
                    <h2 className="row-title">{concert.artist_name}</h2>
                    <p className="row-meta">
                      {[concert.venue_name, concert.city, formatDate(concert.date)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div
                    className={`score-pill ${isBaseline ? 'locked' : ''}`}
                    style={{ color }}
                    aria-label={isBaseline ? 'Score locked until another show is ranked in this bucket' : undefined}
                    title={isBaseline ? 'Score locked' : undefined}
                  >
                    {isBaseline ? '' : getRatingDisplay(concert.elo_score)}
                  </div>
                </Link>
              )
            })}
          </section>
        </div>
      )}
    </main>
  )
}
