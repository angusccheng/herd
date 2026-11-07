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
  const [editingGenres, setEditingGenres] = useState(false)
  const [genresDraft, setGenresDraft] = useState<string[]>([])
  const [genreInput, setGenreInput] = useState('')
  const [savingGenres, setSavingGenres] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [mediaError, setMediaError] = useState('')

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
        setGenresDraft(data.genres || [])

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

    if (concert && concert.media_urls.length > 0) {
      const { data: files } = await supabase.storage.from('concert-media').list(`${concert.user_id}/${concert.id}`)
      if (files && files.length > 0) {
        await supabase.storage.from('concert-media').remove(files.map(f => `${concert.user_id}/${concert.id}/${f.name}`))
      }
    }

    await supabase.from('concerts').delete().eq('id', params.id)
    router.push('/')
  }

  async function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    e.target.value = ''
    if (!files || files.length === 0 || !concert) return

    setUploadingMedia(true)
    setMediaError('')

    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${concert.user_id}/${concert.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('concert-media').upload(path, file, { contentType: file.type })
      if (uploadError) {
        setMediaError(uploadError.message)
        continue
      }
      const { data } = supabase.storage.from('concert-media').getPublicUrl(path)
      newUrls.push(data.publicUrl)
    }

    if (newUrls.length > 0) {
      const nextMediaUrls = [...concert.media_urls, ...newUrls]
      await supabase.from('concerts').update({ media_urls: nextMediaUrls }).eq('id', concert.id)
      setConcert({ ...concert, media_urls: nextMediaUrls })
    }

    setUploadingMedia(false)
  }

  async function handleMediaDelete(url: string) {
    if (!concert) return
    const path = url.split('/concert-media/')[1]
    if (path) await supabase.storage.from('concert-media').remove([path])
    const nextMediaUrls = concert.media_urls.filter(u => u !== url)
    await supabase.from('concerts').update({ media_urls: nextMediaUrls }).eq('id', concert.id)
    setConcert({ ...concert, media_urls: nextMediaUrls })
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

  async function handleSaveGenres() {
    if (!concert) return
    setSavingGenres(true)
    await supabase.from('concerts').update({ genres: genresDraft }).eq('id', concert.id)
    setConcert({ ...concert, genres: genresDraft })
    setEditingGenres(false)
    setSavingGenres(false)
  }

  function handleAddGenre() {
    const g = genreInput.trim().toLowerCase()
    if (g && !genresDraft.includes(g)) setGenresDraft(prev => [...prev, g])
    setGenreInput('')
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

        <div className="detail-body">
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

          <aside className="panel side-panel genre-panel">
            <div className="panel-heading">
              <span className="label">Genres</span>
              {!editingGenres && (
                <button className="text-button" type="button" onClick={() => { setGenresDraft(concert.genres || []); setEditingGenres(true) }}>
                  Edit
                </button>
              )}
            </div>
            {editingGenres ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                <div className="genre-list">
                  {genresDraft.map(g => (
                    <span className="chip active" key={g} style={{ cursor: 'pointer' }} onClick={() => setGenresDraft(prev => prev.filter(x => x !== g))}>
                      {g} ×
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="input"
                    value={genreInput}
                    onChange={e => setGenreInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddGenre() } }}
                    placeholder="Add genre…"
                    style={{ flex: 1, fontSize: 13 }}
                  />
                  <button className="button secondary" type="button" onClick={handleAddGenre} style={{ whiteSpace: 'nowrap' }}>Add</button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="button" type="button" onClick={handleSaveGenres} disabled={savingGenres}>{savingGenres ? 'Saving…' : 'Save'}</button>
                  <button className="button secondary" type="button" onClick={() => setEditingGenres(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="genre-list" style={{ marginTop: 8 }}>
                {concert.genres && concert.genres.length > 0
                  ? concert.genres.map(g => <span className="chip active" key={g}>{g}</span>)
                  : <span style={{ opacity: 0.4, fontSize: 13 }}>No genres yet</span>}
              </div>
            )}
          </aside>
        </div>

        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-heading">
            <span className="label">Media</span>
            <label className="text-button" style={{ cursor: uploadingMedia ? 'default' : 'pointer' }}>
              {uploadingMedia ? 'Uploading…' : 'Add photo/video'}
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleMediaUpload}
                disabled={uploadingMedia}
              />
            </label>
          </div>
          {mediaError && <div className="error-box">{mediaError}</div>}
          {concert.media_urls.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginTop: 10 }}>
              {concert.media_urls.map(url => {
                const isVideo = /\.(mp4|mov|webm|m4v)$/i.test(url)
                return (
                  <div key={url} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
                    {isVideo ? (
                      <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                    ) : (
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <button
                      type="button"
                      onClick={() => handleMediaDelete(url)}
                      style={{
                        position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', fontSize: 13, lineHeight: 1, cursor: 'pointer',
                      }}
                      aria-label="Remove media"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ marginTop: 10, color: 'var(--muted)' }}>No photos or videos yet.</p>
          )}
        </section>

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
