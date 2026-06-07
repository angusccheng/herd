import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
  created_at: string
}
