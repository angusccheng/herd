'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, Concert } from '@/lib/supabase'
import {
  getConcertBucket,
  isSentimentBucket,
  SentimentBucket,
} from '@/lib/ranking'
import { useUser } from '@/lib/auth'

type PlacementState = {
  newConcert: Concert
  pool: Concert[]
  bucket: SentimentBucket
  low: number
  high: number
  done: boolean
  finalIndex: number | null
  skippedIds: string[]
}

export default function ComparePage() {
  return (
    <Suspense fallback={<CompareLoading />}>
      <CompareContent />
    </Suspense>
  )
}

function CompareLoading() {
  return (
    <main className="app-shell">
      <div className="panel empty-state">
        <p>Loading comparison...</p>
      </div>
    </main>
  )
}

function chooseOpponentIndex(state: PlacementState | null) {
  if (!state || state.done) return null

  const candidates = Array.from(
    { length: state.high - state.low },
    (_, offset) => state.low + offset
  )
  const available = candidates.filter(index => !state.skippedIds.includes(state.pool[index].id))

  if (available.length === 0) return null

  const midpoint = Math.floor((state.low + state.high) / 2)
  return available.sort((a, b) => Math.abs(a - midpoint) - Math.abs(b - midpoint))[0]
}

function CompareContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const newConcertId = searchParams.get('new')
  const bucketParam = searchParams.get('bucket')
  const { user } = useUser()

  const [state, setState] = useState<PlacementState | null>(null)
  const [history, setHistory] = useState<PlacementState[]>([])
  const [loading, setLoading] = useState(true)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return

    async function fetchConcerts() {
      const { data, error: fetchError } = await supabase
        .from('concerts')
        .select('*')
        .eq('user_id', user!.id)

      if (fetchError || !data) {
        setError(fetchError?.message || 'Could not load concerts')
        setLoading(false)
        return
      }

      if (!newConcertId) {
        router.push('/')
        return
      }

      const newConcert = data.find(c => c.id === newConcertId)

      if (!newConcert) {
        router.push('/')
        return
      }

      const bucket = isSentimentBucket(bucketParam)
        ? bucketParam
        : getConcertBucket(newConcert)
      const pool = data
        .filter(c => c.id !== newConcert.id && getConcertBucket(c) === bucket)
        .sort((a, b) => (a.rank_position ?? 0) - (b.rank_position ?? 0))

      setState({
        newConcert,
        pool,
        bucket,
        low: 0,
        high: pool.length,
        done: pool.length === 0,
        finalIndex: pool.length === 0 ? 0 : null,
        skippedIds: [],
      })
      setHistory([])
      setLoading(false)
    }

    fetchConcerts()
  }, [bucketParam, newConcertId, router, user])

  const opponentIndex = chooseOpponentIndex(state)
  const opponent = opponentIndex !== null && state ? state.pool[opponentIndex] : null
  const candidateCount = state ? state.high - state.low : 0
  const canSkip = !!state && !!opponent && candidateCount > 1

  async function finalizePlacement(nextState: PlacementState, finalIndex: number) {
    const rankPosition = finalIndex + 1
    const previousRankPosition = nextState.newConcert.rank_position ?? undefined

    const res = await fetch('/api/place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newConcertId: nextState.newConcert.id,
        bucket: nextState.bucket,
        rankPosition,
        previousRankPosition,
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.error || 'Could not place concert')
    }
  }

  async function handlePick(newConcertWasBetter: boolean) {
    if (!state || !opponent || opponentIndex === null || picking) return
    setPicking(true)
    setError('')

    const low = newConcertWasBetter ? state.low : opponentIndex + 1
    const high = newConcertWasBetter ? opponentIndex : state.high
    const finalIndex = low >= high ? low : null
    const nextState = {
      ...state,
      low,
      high,
      done: finalIndex !== null,
      finalIndex,
      skippedIds: [],
    }

    if (finalIndex !== null) {
      try {
        await finalizePlacement(nextState, finalIndex)
      } catch (placementError) {
        setError(placementError instanceof Error ? placementError.message : 'Could not place concert')
        setPicking(false)
        return
      }
    }

    setHistory(prev => [...prev, state])
    setState(nextState)
    setPicking(false)
  }

  function handleSkip() {
    if (!state || !opponent || !canSkip) return
    const skippedIds = [...state.skippedIds, opponent.id]
    const remaining = state.pool
      .slice(state.low, state.high)
      .filter(concert => !skippedIds.includes(concert.id))

    setState({
      ...state,
      skippedIds: remaining.length === 0 ? [] : skippedIds,
    })
  }

  function handleUndo() {
    const previous = history.at(-1)
    if (!previous) return
    setHistory(prev => prev.slice(0, -1))
    setState(previous)
    setError('')
  }

  if (loading) {
    return <CompareLoading />
  }

  if (!state) {
    return (
      <main className="app-shell">
        <div className="panel empty-state">
          <p>Could not start ranking.</p>
          <Link className="button" href="/">Back to rankings</Link>
        </div>
      </main>
    )
  }

  if (state.done) {
    return (
      <main className="app-shell">
        <section className="compare-shell panel empty-state">
          <h1 className="page-title">Ranking saved</h1>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="button" onClick={() => router.push('/')}>See rankings</button>
            <Link className="button secondary" href="/add">Add another</Link>
          </div>
        </section>
      </main>
    )
  }

  if (!opponent) return null

  return (
    <main className="app-shell">
      <section className="compare-shell">
        <div className="page-topbar">
          <div className="brand-lockup">
            <h1 className="page-title">Which show did you prefer?</h1>
          </div>
          <div className="compare-actions">
            <button className="button secondary" type="button" onClick={handleUndo} disabled={history.length === 0 || picking}>
              Undo
            </button>
            <button className="button secondary" type="button" onClick={handleSkip} disabled={!canSkip || picking}>
              Skip
            </button>
          </div>
        </div>

        <div className="panel form-section">
          <div className="compare-layout">
            <ConcertCard
              concert={state.newConcert}
              onPick={() => handlePick(true)}
              disabled={picking}
            />
            <div className="vs-mark">or</div>
            <ConcertCard
              concert={opponent}
              onPick={() => handlePick(false)}
              disabled={picking}
            />
          </div>

          {error && <div className="error-box">{error}</div>}
        </div>
      </section>
    </main>
  )
}

function ConcertCard({
  concert,
  onPick,
  disabled,
}: {
  concert: Concert
  onPick: () => void
  disabled: boolean
}) {
  return (
    <button className="compare-card" onClick={onPick} disabled={disabled}>
      <h2 className="row-title">{concert.artist_name}</h2>
      <p className="row-meta">
        {[concert.venue_name, concert.city].filter(Boolean).join(' · ')}
        {concert.date && (
          <span> · {new Date(concert.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
        )}
      </p>
    </button>
  )
}
