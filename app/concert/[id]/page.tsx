'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Concert } from '@/lib/supabase'
import { getConcertBucket, getRatingColor, getRatingDisplay, SentimentBucket } from '@/lib/ranking'

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ConcertDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [concert, setConcert] = useState<Concert | null>(null)
  const [bucketTotal, setBucketTotal] = useState(1)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesError, setNotesError] = useState('')

  useEffect(() => {
    async function fetchConcert() {
      const { data, error } = await supabase
        .from('concerts')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) {
        console.error(error)
      } else {
        setConcert(data)
        setNotesDraft(data.notes || '')

        const { count } = await supabase
          .from('concerts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', data.user_id)
          .eq('bucket', data.bucket)
        setBucketTotal(count ?? 1)
      }
      setLoading(false)
    }

    fetchConcert()
  }, [params.id])

  useEffect(() => {
    if (!concert) return

    async function refreshTotal() {
      if (document.hidden) return
      const { count } = await supabase
        .from('concerts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', concert!.user_id)
        .eq('bucket', concert!.bucket)
      setBucketTotal(count ?? 1)
    }

    document.addEventListener('visibilitychange', refreshTotal)
    return () => document.removeEventListener('visibilitychange', refreshTotal)
  }, [concert])

  async function handleDelete() {
    if (!confirm('Delete this show?')) return
    setDeleting(true)

    // Compact rank positions: shift all shows ranked below this one up by 1
    if (concert && concert.rank_position !== null) {
      const { data: toCompact } = await supabase
        .from('concerts')
        .select('id, rank_position')
        .eq('user_id', concert.user_id)
        .eq('bucket', concert.bucket)
        .gt('rank_position', concert.rank_position)
        .neq('id', concert.id)

      if (toCompact && toCompact.length > 0) {
        await Promise.all(
          toCompact.map(c =>
            supabase.from('concerts').update({ rank_position: c.rank_position! - 1 }).eq('id', c.id)
          )
        )
      }
    }

    await supabase.from('concerts').delete().eq('id', params.id)
    router.push('/')
  }

  async function handleSaveNotes() {
    if (!concert) return
    setSavingNotes(true)
    setNotesError('')

    const nextNotes = notesDraft.trim() || null
    const { error } = await supabase
      .from('concerts')
      .update({ notes: nextNotes })
      .eq('id', concert.id)

    if (error) {
      setNotesError(error.message)
      setSavingNotes(false)
      return
    }

    setConcert({ ...concert, notes: nextNotes })
    setEditingNotes(false)
    setSavingNotes(false)
  }

  function handleCancelNotes() {
    setNotesDraft(concert?.notes || '')
    setNotesError('')
    setEditingNotes(false)
  }

  function handleRerank() {
    if (!concert) return
    router.push(`/compare?new=${concert.id}&bucket=${getConcertBucket(concert)}`)
  }

  if (loading) {
    return (
      <main className="app-shell">
        <div className="panel empty-state">
          <p>Loading show...</p>
        </div>
      </main>
    )
  }

  if (!concert) {
    return (
      <main className="app-shell">
        <div className="panel empty-state">
          <p>Show not found</p>
          <Link className="button" href="/">Back to rankings</Link>
        </div>
      </main>
    )
  }

  const bucket = getConcertBucket(concert)
  const color = getRatingColor(bucket)

  return (
    <main className="app-shell">
      <div className="detail-shell">
        <div className="page-topbar">
          <Link className="button secondary" href="/">
            All shows
          </Link>
        </div>

        <section className="panel detail-hero">
          <div>
            <h1 className="page-title">{concert.artist_name}</h1>
            <p className="detail-meta">
              {[concert.venue_name, concert.city, formatDate(concert.date)].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="detail-score-stack">
            <div className="score-pill" style={{ color }}>
              {concert.rank_position != null && bucketTotal > 1
                ? getRatingDisplay(bucket as SentimentBucket, concert.rank_position, bucketTotal)
                : ''}
            </div>
            <button className="button secondary" type="button" onClick={handleRerank}>
              Rerank
            </button>
          </div>
        </section>

        <div className={concert.genres && concert.genres.length > 0 ? 'detail-body' : 'detail-body single'}>
          <section className="panel note-panel">
            <div className="panel-heading">
              <span className="label">Notes</span>
              {!editingNotes && (
                <button className="text-button" type="button" onClick={() => setEditingNotes(true)}>
                  Edit
                </button>
              )}
            </div>

            {editingNotes ? (
              <div className="notes-editor">
                <textarea
                  className="input"
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  placeholder="Best moment? Setlist highlight? Opener?"
                  rows={5}
                />
                {notesError && <div className="error-box">{notesError}</div>}
                <div className="editor-actions">
                  <button className="button" type="button" onClick={handleSaveNotes} disabled={savingNotes}>
                    {savingNotes ? 'Saving...' : 'Save notes'}
                  </button>
                  <button className="button secondary" type="button" onClick={handleCancelNotes} disabled={savingNotes}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : concert.notes ? (
              <p style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{concert.notes}</p>
            ) : (
              <p style={{ marginTop: 10, color: 'var(--muted)' }}>No notes yet.</p>
            )}
          </section>

          {concert.genres && concert.genres.length > 0 && (
            <aside className="panel side-panel genre-panel">
              <h2>Genres</h2>
              <div className="genre-list" style={{ marginTop: 0 }}>
                {concert.genres.map(g => (
                  <span className="chip active" key={g}>{g}</span>
                ))}
              </div>
            </aside>
          )}
        </div>

        <div style={{ marginTop: 18 }}>
          <button
            className="button danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete show'}
          </button>
        </div>
      </div>
    </main>
  )
}
