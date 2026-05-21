'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <Link className={`nav-item ${pathname === '/' ? 'active' : ''}`} href="/">
        Rankings
      </Link>
      <Link className="nav-add" href="/add" aria-label="Add show">
        +
      </Link>
      <Link className={`nav-item ${pathname === '/profile' ? 'active' : ''}`} href="/profile">
        Profile
      </Link>
    </nav>
  )
}
