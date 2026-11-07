import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type Profile = {
  id: string
  username: string | null
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  spotify_url: string | null
  instagram_url: string | null
  created_at: string
}

export type Concert = {
  id: string
  user_id: string
  artist_id?: string | null
  venue_id?: string | null
  event_id?: string | null
  event_name?: string | null
  artist_name: string
  venue_name: string | null
  city: string | null
  date: string | null
  notes: string | null
  genres: string[]
  bucket: 'liked' | 'fine' | 'didnt'
  rank_position: number | null
  media_urls: string[]
  created_at: string
}
