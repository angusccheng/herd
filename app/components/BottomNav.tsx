'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function BottomNav() {
  const pathname = usePathname()

  if (pathname.startsWith('/login') || pathname.startsWith('/auth') || pathname.startsWith('/onboarding')) return null

  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <Link className={`nav-item ${pathname === '/' ? 'active' : ''}`} href="/">
        <svg className="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="3.5" cy="6" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="3.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="3.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
        </svg>
        <span>Rankings</span>
      </Link>
      <Link className="nav-add" href="/add" aria-label="Add show">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </Link>
      <Link className={`nav-item ${pathname === '/profile' ? 'active' : ''}`} href="/profile">
        <svg className="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 20c1.4-4 4-6 7.5-6s6.1 2 7.5 6" />
        </svg>
        <span>Profile</span>
      </Link>
    </nav>
  )
}
