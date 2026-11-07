'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/auth'

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useUser()
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function sanitizeHandle(raw: string) {
    return raw.toLowerCase().replace(/[^a-z0-9_]/g, '')
  }

  useEffect(() => {
    if (!handle || handle.length < 2) {
      setHandleStatus('idle')
      return
    }
    setHandleStatus('checking')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('usernames')
        .select('user_id')
        .eq('username', handle)
        .maybeSingle()
      if (data && data.user_id !== user?.id) {
        setHandleStatus('taken')
      } else {
        setHandleStatus('available')
      }
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [handle, user?.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!displayName.trim()) { setError('Display name is required.'); return }
    if (!handle.trim()) { setError('Handle is required.'); return }
    if (handle.length < 2) { setError('Handle must be at least 2 characters.'); return }
    if (handleStatus === 'taken') { setError('That handle is already taken. Try another.'); return }

    setSaving(true)

    await supabase.from('usernames').delete().eq('user_id', user!.id)
    const { error: usernameError } = await supabase
      .from('usernames')
      .insert({ username: handle, user_id: user!.id })

    if (usernameError) {
      setError('That handle is already taken. Try another.')
      setSaving(false)
      return
    }

    await supabase.auth.updateUser({
      data: { display_name: displayName.trim(), username: handle }
    })

    router.push('/')
  }

  const handleBorderColor =
    handleStatus === 'available' ? '#22c55e' :
    handleStatus === 'taken' ? '#ef4444' :
    undefined

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 32 }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Welcome to Herd</h1>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 15 }}>Set up your identity before logging your first show.</p>
        </div>

        {/* Display Name */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20 }}>
          <div>
            <p className="section-title" style={{ marginBottom: 2 }}>Display Name</p>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.55, lineHeight: 1.4 }}>
              Your real name or how you want to be known. Spaces and special characters are fine — this is what people see on your profile. Can be changed later.
            </p>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <input
              className="input"
              placeholder="e.g. Alex Rivera"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              autoFocus
              autoComplete="name"
            />
          </div>
        </div>

        {/* Handle */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20 }}>
          <div>
            <p className="section-title" style={{ marginBottom: 2 }}>@Handle</p>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.55, lineHeight: 1.4 }}>
              Your unique tag — used for mentions and profile links. Letters, numbers, and underscores only. You can change this once every 30 days.
            </p>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                opacity: 0.4, fontSize: 15, pointerEvents: 'none', userSelect: 'none'
              }}>@</span>
              <input
                className="input"
                style={{
                  paddingLeft: 26,
                  borderColor: handleBorderColor,
                  outlineColor: handleBorderColor,
                }}
                placeholder="alex_rivera"
                value={handle}
                onChange={e => setHandle(sanitizeHandle(e.target.value))}
                autoComplete="username"
                spellCheck={false}
              />
              {handleStatus === 'available' && (
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#22c55e', fontSize: 18 }}>✓</span>
              )}
              {handleStatus === 'taken' && (
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#ef4444', fontSize: 18 }}>✗</span>
              )}
            </div>
            {handle && handleStatus === 'taken' && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>That handle is already taken.</p>
            )}
            {handle && handleStatus === 'available' && (
              <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.45 }}>Your profile link: herd.app/@{handle}</p>
            )}
            {handle && handleStatus === 'checking' && (
              <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.45 }}>Checking availability…</p>
            )}
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        <button className="button" type="submit" disabled={saving || handleStatus === 'taken' || handleStatus === 'checking'} style={{ width: '100%' }}>
          {saving ? 'Setting up…' : 'Get started'}
        </button>

      </form>
    </main>
  )
}
