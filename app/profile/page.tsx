'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase, Concert } from '@/lib/supabase'
import { useUser } from '@/lib/auth'
import { getRatingColor, getRatingDisplay, SentimentBucket } from '@/lib/ranking'
import { geocodePlace } from '@/lib/geocode'
import type { MapPoint } from '@/app/components/ConcertMap'

const ConcertMap = dynamic(
  () => import('@/app/components/ConcertMap').then(m => m.ConcertMap),
  { ssr: false }
)

type ProfileData = {
  display_name: string | null
  username: string | null
  bio: string | null
  avatar_url: string | null
  spotify_url: string | null
  instagram_url: string | null
  handle_changed_at: string | null
}

const HANDLE_COOLDOWN_DAYS = 30

function daysRemaining(handleChangedAt: string | null): number {
  if (!handleChangedAt) return 0
  const elapsedMs = Date.now() - new Date(handleChangedAt).getTime()
  const elapsedDays = elapsedMs / 86400000
  return Math.max(0, Math.ceil(HANDLE_COOLDOWN_DAYS - elapsedDays))
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function topItem(items: string[]): string | null {
  if (items.length === 0) return null
  const counts: Record<string, number> = {}
  for (const item of items) counts[item] = (counts[item] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

export default function ProfilePage() {
  const router = useRouter()
  const { user } = useUser()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<ProfileData>({
    display_name: null, username: null, bio: null,
    avatar_url: null, spotify_url: null, instagram_url: null, handle_changed_at: null,
  })
  const [concerts, setConcerts] = useState<Concert[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ display_name: '', username: '', bio: '', spotify_url: '', instagram_url: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([])

  // Persist draft edits across navigation so users don't lose mid-edit state
  const draftKey = user ? `profile_draft_${user.id}` : null

  useEffect(() => {
    if (!user) return

    const meta = user.user_metadata ?? {}
    const loaded: ProfileData = {
      display_name: meta.display_name ?? null,
      username: meta.username ?? null,
      bio: meta.bio ?? null,
      avatar_url: meta.avatar_url ?? null,
      spotify_url: meta.spotify_url ?? null,
      instagram_url: meta.instagram_url ?? null,
      handle_changed_at: meta.handle_changed_at ?? null,
    }
    setProfile(loaded)

    const savedDraft = draftKey ? localStorage.getItem(draftKey) : null
    if (savedDraft) {
      try {
        setEditForm(JSON.parse(savedDraft))
        setEditing(true)
      } catch {
        localStorage.removeItem(draftKey!)
        setEditForm({
          display_name: loaded.display_name ?? '',
          username: loaded.username ?? '',
          bio: loaded.bio ?? '',
          spotify_url: loaded.spotify_url ?? '',
          instagram_url: loaded.instagram_url ?? '',
        })
      }
    } else {
      setEditForm({
        display_name: loaded.display_name ?? '',
        username: loaded.username ?? '',
        bio: loaded.bio ?? '',
        spotify_url: loaded.spotify_url ?? '',
        instagram_url: loaded.instagram_url ?? '',
      })
    }

    supabase.from('concerts').select('*').eq('user_id', user.id).then(async ({ data }) => {
      const allConcerts = data ?? []
      setConcerts(allConcerts)

      // Group by venue + city so each venue gets its own pin instead of one per city.
      const placeCount: Record<string, { place: string; count: number }> = {}
      for (const c of allConcerts) {
        if (!c.city) continue
        const place = c.venue_name ? `${c.venue_name}, ${c.city}` : c.city
        const key = place.toLowerCase()
        placeCount[key] = { place, count: (placeCount[key]?.count ?? 0) + 1 }
      }

      const results = await Promise.all(
        Object.values(placeCount).map(async ({ place, count }) => {
          const coords = await geocodePlace(place)
          return coords ? { city: place, lat: coords[0], lng: coords[1], count } : null
        })
      )
      setMapPoints(results.filter((p): p is MapPoint => p !== null))
      setLoading(false)
    })
  }, [user])

  // Persist draft whenever form changes while editing
  useEffect(() => {
    if (!editing || !draftKey) return
    localStorage.setItem(draftKey, JSON.stringify(editForm))
  }, [editForm, editing, draftKey])

  function clearDraft() {
    if (draftKey) localStorage.removeItem(draftKey)
  }

  async function handleSaveProfile() {
    if (!user) return
    setSaving(true)
    setSaveError('')

    const newHandle = editForm.username.trim().toLowerCase() || null
    const handleChanged = newHandle !== profile.username

    // Enforce unique handle + 30-day cooldown if it changed
    if (handleChanged && newHandle) {
      const remaining = daysRemaining(profile.handle_changed_at)
      if (remaining > 0) {
        setSaveError(`You can change your handle again in ${remaining} day${remaining === 1 ? '' : 's'}.`)
        setSaving(false)
        return
      }

      const { data: existing } = await supabase
        .from('usernames')
        .select('user_id')
        .eq('username', newHandle)
        .maybeSingle()

      if (existing && existing.user_id !== user.id) {
        setSaveError('That handle is already taken.')
        setSaving(false)
        return
      }

      // Update the usernames registry
      await supabase.from('usernames').delete().eq('user_id', user.id)
      await supabase.from('usernames').insert({ username: newHandle, user_id: user.id })
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        display_name: editForm.display_name.trim() || null,
        username: newHandle,
        bio: editForm.bio.trim() || null,
        spotify_url: editForm.spotify_url.trim() || null,
        instagram_url: editForm.instagram_url.trim() || null,
        handle_changed_at: handleChanged ? new Date().toISOString() : profile.handle_changed_at,
      }
    })

    if (error) {
      setSaveError(error.message)
      setSaving(false)
      return
    }

    setProfile(prev => ({
      ...prev,
      ...editForm,
      handle_changed_at: handleChanged ? new Date().toISOString() : prev.handle_changed_at,
    }))
    clearDraft()
    setEditing(false)
    setSaving(false)
  }

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const onCropComplete = useCallback((_: unknown, pixels: { x: number; y: number; width: number; height: number }) => {
    setCroppedAreaPixels(pixels)
  }, [])

  async function handleCropConfirm() {
    if (!cropSrc || !croppedAreaPixels || !user) return
    setUploading(true)
    setCropSrc(null)

    const blob = await getCroppedBlob(cropSrc, croppedAreaPixels)
    const path = `${user.id}/avatar.jpg`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
    } else {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`
      await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } })
      setProfile(prev => ({ ...prev, avatar_url: avatarUrl }))
    }
    setUploading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <main className="app-shell">
        <div className="panel empty-state"><p>Loading profile…</p></div>
      </main>
    )
  }

  const displayName = profile.display_name || user?.email?.split('@')[0] || 'You'
  const likedConcerts = concerts.filter(c => c.bucket === 'liked').sort((a, b) => (a.rank_position ?? 0) - (b.rank_position ?? 0))
  const topLiked = likedConcerts.slice(0, 10)
  const likedTotal = likedConcerts.length
  const recent = [...concerts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)
  const topArtist = topItem(concerts.map(c => c.artist_name))
  const topGenre = topItem(concerts.flatMap(c => c.genres))
  const handleCooldownDays = daysRemaining(profile.handle_changed_at)

  return (
    <main className="app-shell">
      <div className="page-topbar">
        <div className="brand-lockup">
          <h1 className="page-title">Profile</h1>
        </div>
      </div>

      <div className="surface-grid">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="panel profile-header">
        <div>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div className="avatar-wrap" onClick={() => !uploading && setShowAvatarMenu(m => !m)} title="Edit photo">
              {profile.avatar_url ? (
                <img className="avatar-img" src={profile.avatar_url} alt={displayName} />
              ) : (
                <div className="avatar-placeholder">{(profile.username || displayName)[0].toUpperCase()}</div>
              )}
              <div className="avatar-upload-overlay">{uploading ? '…' : 'Edit'}</div>
            </div>

            {showAvatarMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowAvatarMenu(false)} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 100,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  minWidth: 170, overflow: 'hidden',
                }}>
                  <button className="canonical-option" style={{ width: '100%', textAlign: 'left' }} onClick={() => { setShowAvatarMenu(false); fileInputRef.current?.click() }}>
                    Upload new photo
                  </button>
                  {profile.avatar_url && (
                    <button className="canonical-option" style={{ width: '100%', textAlign: 'left' }} onClick={() => { setShowAvatarMenu(false); setCropSrc(profile.avatar_url!) }}>
                      Crop current photo
                    </button>
                  )}
                  {profile.avatar_url && (
                    <button className="canonical-option" style={{ width: '100%', textAlign: 'left', color: 'var(--bad)' }} onClick={async () => {
                      setShowAvatarMenu(false)
                      if (!user) return
                      await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`])
                      await supabase.auth.updateUser({ data: { avatar_url: null } })
                      setProfile(prev => ({ ...prev, avatar_url: null }))
                    }}>
                      Remove photo
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarSelect} />
        </div>

        <div className="profile-info">
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-grid" style={{ gap: 12 }}>
                <div className="field">
                  <label className="label" htmlFor="display_name">Display Name</label>
                  <input className="input" id="display_name" value={editForm.display_name} onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Your name" autoComplete="name" />
                </div>
                <div className="field">
                  <label className="label" htmlFor="username">@Handle</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, fontSize: 15, pointerEvents: 'none' }}>@</span>
                    <input
                      className="input"
                      id="username"
                      style={{ paddingLeft: 26 }}
                      value={editForm.username}
                      onChange={e => setEditForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                      placeholder="yourhandle"
                      autoComplete="username"
                      spellCheck={false}
                      disabled={handleCooldownDays > 0}
                    />
                  </div>
                  {handleCooldownDays > 0 && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.55 }}>
                      You can change your handle again in {handleCooldownDays} day{handleCooldownDays === 1 ? '' : 's'}.
                    </p>
                  )}
                </div>
                <div className="field full">
                  <label className="label" htmlFor="bio" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Bio</span>
                    <span style={{ opacity: editForm.bio.length > 90 ? 1 : 0.4, color: editForm.bio.length >= 100 ? 'var(--bad)' : 'inherit', fontWeight: 400 }}>{editForm.bio.length}/100</span>
                  </label>
                  <textarea className="input" id="bio" rows={2} maxLength={100} value={editForm.bio} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value.slice(0, 100) }))} placeholder="A line about your taste" style={{ resize: 'none', maxHeight: 80 }} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="spotify_url">Spotify URL</label>
                  <input className="input" id="spotify_url" value={editForm.spotify_url} onChange={e => setEditForm(f => ({ ...f, spotify_url: e.target.value }))} placeholder="https://open.spotify.com/user/…" />
                </div>
                <div className="field">
                  <label className="label" htmlFor="instagram_url">Instagram URL</label>
                  <input className="input" id="instagram_url" value={editForm.instagram_url} onChange={e => setEditForm(f => ({ ...f, instagram_url: e.target.value }))} placeholder="https://instagram.com/…" />
                </div>
              </div>
              {saveError && <div className="error-box">{saveError}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="button" type="button" onClick={handleSaveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                <button className="button secondary" type="button" onClick={() => { clearDraft(); setEditing(false); setSaveError('') }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <h2 className="profile-name">{displayName}</h2>
                {profile.username && <span className="profile-handle">@{profile.username}</span>}
              </div>
              {profile.bio && <p className="profile-bio">{profile.bio.slice(0, 100)}</p>}
              {(profile.spotify_url || profile.instagram_url) && (
                <div className="profile-links">
                  {profile.spotify_url && (
                    <a className="profile-link" href={profile.spotify_url} target="_blank" rel="noreferrer">Spotify</a>
                  )}
                  {profile.instagram_url && (
                    <a className="profile-link" href={profile.instagram_url} target="_blank" rel="noreferrer">Instagram</a>
                  )}
                </div>
              )}
              <button className="button secondary" type="button" style={{ marginTop: 12, alignSelf: 'flex-start' }} onClick={() => setEditing(true)}>
                Edit profile
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────── */}
      <div className="stat-row">
        <div className="panel stat-card">
          <span className="stat-value">{concerts.length}</span>
          <span className="stat-label">Shows</span>
        </div>
        <div className="panel stat-card">
          <span className="stat-label">Top Artist</span>
          <span className="stat-sub">{topArtist ?? '—'}</span>
        </div>
        <div className="panel stat-card">
          <span className="stat-label">Top Genre</span>
          <span className="stat-sub">{topGenre ?? '—'}</span>
        </div>
      </div>

      {/* ── Map ────────────────────────────────────────── */}
      {mapPoints.length > 0 && (
        <section>
          <p className="section-title">Map</p>
          <div className="map-wrap">
            <ConcertMap points={mapPoints} />
          </div>
        </section>
      )}

      {/* ── Top 10 Liked ───────────────────────────────── */}
      {topLiked.length > 0 && (
        <section>
          <p className="section-title">Top Liked Shows</p>
          <div className="panel rank-list">
            {topLiked.map((concert, index) => {
              const color = getRatingColor('liked')
              const effectiveRank = concert.rank_position ?? (index + 1)
              const score = likedTotal > 1
                ? getRatingDisplay('liked' as SentimentBucket, effectiveRank, likedTotal)
                : null

              return (
                <Link className="rank-row" key={concert.id} href={`/concert/${concert.id}`}>
                  <div className="rank-number">{index + 1}</div>
                  <div>
                    <h2 className="row-title">{concert.artist_name}</h2>
                    <p className="row-meta">
                      {[concert.venue_name, concert.city, formatDate(concert.date)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="score-pill" style={{ color }}>
                    {score ?? ''}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Recent Activity ────────────────────────────── */}
      {recent.length > 0 && (
        <section>
          <p className="section-title">Recent Activity</p>
          <div className="panel rank-list">
            {recent.map(concert => (
              <Link className="rank-row" key={concert.id} href={`/concert/${concert.id}`} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <div>
                  <h2 className="row-title">{concert.artist_name}</h2>
                  <p className="row-meta">{[concert.venue_name, concert.city].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="eyebrow" style={{ whiteSpace: 'nowrap' }}>{formatRelative(concert.created_at)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {concerts.length === 0 && (
        <div className="panel empty-state">
          <h2>No shows yet</h2>
          <p>Start logging concerts to build your profile.</p>
          <Link className="button" href="/add">Log first show</Link>
        </div>
      )}

      {/* ── Sign out ───────────────────────────────────── */}
      <div>
        <button className="button danger" type="button" onClick={handleSignOut}>Sign out</button>
      </div>

      </div>

      {cropSrc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div style={{ padding: '16px 24px', background: '#111', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ width: '100%' }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="button" onClick={handleCropConfirm} disabled={uploading}>{uploading ? 'Uploading…' : 'Save photo'}</button>
              <button className="button secondary" onClick={() => setCropSrc(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

async function getCroppedBlob(imageSrc: string, crop: { x: number; y: number; width: number; height: number }): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = imageSrc
  })
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 400
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, 400, 400)
  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.9))
}
