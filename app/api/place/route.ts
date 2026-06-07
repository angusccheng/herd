import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { isSentimentBucket } from '@/lib/ranking'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { newConcertId, bucket, rankPosition, previousRankPosition } = await req.json()
  const userId = user.id

  if (!newConcertId || !isSentimentBucket(bucket) || typeof rankPosition !== 'number') {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
  }

  if (typeof previousRankPosition === 'number') {
    const { data: toShiftUp } = await supabase
      .from('concerts')
      .select('id, rank_position')
      .eq('user_id', userId)
      .eq('bucket', bucket)
      .neq('id', newConcertId)
      .gt('rank_position', previousRankPosition)

    if (toShiftUp && toShiftUp.length > 0) {
      await Promise.all(toShiftUp.map(c =>
        supabase.from('concerts').update({ rank_position: c.rank_position - 1 }).eq('id', c.id)
      ))
    }
  }

  const { data: toShift } = await supabase
    .from('concerts')
    .select('id, rank_position')
    .eq('user_id', userId)
    .eq('bucket', bucket)
    .neq('id', newConcertId)
    .gte('rank_position', rankPosition)

  if (toShift && toShift.length > 0) {
    await Promise.all(toShift.map(c =>
      supabase.from('concerts').update({ rank_position: c.rank_position + 1 }).eq('id', c.id)
    ))
  }

  const { error: placeError } = await supabase
    .from('concerts')
    .update({ bucket, rank_position: rankPosition })
    .eq('id', newConcertId)
    .eq('user_id', userId)

  if (placeError) {
    return NextResponse.json({ error: 'Failed to place concert' }, { status: 500 })
  }

  return NextResponse.json({ bucket, rankPosition })
}
