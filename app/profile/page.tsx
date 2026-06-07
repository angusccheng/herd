'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/auth'

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading } = useUser()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <main className="app-shell">
      <div className="page-topbar">
        <div className="brand-lockup">
          <h1 className="page-title">Profile</h1>
        </div>
      </div>

      <div className="panel form-section">
        {loading ? (
          <p className="eyebrow">Loading…</p>
        ) : (
          <>
            <div className="field">
              <span className="label">Email</span>
              <span style={{ fontSize: 15 }}>{user?.email}</span>
            </div>

            <button className="button danger" type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </>
        )}
      </div>
    </main>
  )
}
