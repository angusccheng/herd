'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, Concert } from '@/lib/supabase'
import { getConcertBucket, getRatingColor, getRatingDisplay, sortConcerts, SentimentBucket } from '@/lib/ranking'
import { useUser } from '@/lib/auth'

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function HomePage() {
  const { user } = useUser()
  const [concerts, setConcerts] = useState<Concert[]>([])
  const [loading, setLoading] = useState(true)
  const bucketCounts = concerts.reduce<Record<string, number>>((counts, concert) => {
    counts[concert.bucket] = (counts[concert.bucket] || 0) + 1
    return counts
  }, {})

  useEffect(() => {
    if (!user) return

    async function fetchConcerts() {
      const { data, error } = await supabase
        .from('concerts')
        .select('*')
        .eq('user_id', user!.id)

      if (!error) setConcerts(sortConcerts(data || []))
      setLoading(false)
    }

    fetchConcerts()
  }, [user])

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
              const bucket = getConcertBucket(concert)
              const color = getRatingColor(bucket)
              const total = bucketCounts[bucket] ?? 1
              const isBaseline = total === 1

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
                    {isBaseline || concert.rank_position == null ? '' : getRatingDisplay(bucket as SentimentBucket, concert.rank_position, total)}
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
