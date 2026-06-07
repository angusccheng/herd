'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function LoginForm() {
  const searchParams = useSearchParams()
  const hasError = searchParams.get('error') === 'invalid-link'

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState(hasError ? 'That link has expired. Request a new one.' : '')

  useEffect(() => {
    if (!sent) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') setConfirmed(true)
    })

    return () => subscription.unsubscribe()
  }, [sent])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <main className="app-shell" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', paddingBottom: 28 }}>
      <div className="form-shell" style={{ maxWidth: 420, margin: '0 auto', width: '100%' }}>
        <div className="brand-lockup" style={{ marginBottom: 32 }}>
          <h1 className="brand-title">herd</h1>
          <p className="eyebrow">rank concerts by comparing the shows you&apos;ve seen</p>
        </div>

        {confirmed ? (
          <div className="panel form-section">
            <div className="notice-box">
              You&apos;re signed in — you can close this tab.
            </div>
          </div>
        ) : sent ? (
          <div className="panel form-section">
            <div className="notice-box">
              Check your email — we sent a sign-in link to <strong>{email}</strong>.
            </div>
            <button
              className="button secondary"
              type="button"
              onClick={() => setSent(false)}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="panel form-section">
            <div className="field">
              <label className="label" htmlFor="email">Email</label>
              <input
                className="input"
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>

            <button className="button" type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send sign-in link'}
            </button>

            {error && <div className="error-box">{error}</div>}
          </form>
        )}
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
