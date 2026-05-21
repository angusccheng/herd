import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const { concertId, userId, eloScore, placements } = await req.json()

  if (!userId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (Array.isArray(placements)) {
    const updates = placements.filter((placement) =>
      placement &&
      typeof placement.concertId === 'string' &&
      typeof placement.eloScore === 'number'
    )

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Missing placements' }, { status: 400 })
    }

    const results = await Promise.all(updates.map((placement) =>
      supabase
        .from('concerts')
        .update({ elo_score: Math.round(placement.eloScore) })
        .eq('id', placement.concertId)
        .eq('user_id', userId)
    ))

    if (results.some(result => result.error)) {
      return NextResponse.json({ error: 'Failed to place concerts' }, { status: 500 })
    }

    return NextResponse.json({
      placements: updates.map((placement) => ({
        concertId: placement.concertId,
        eloScore: Math.round(placement.eloScore),
      })),
    })
  }

  if (!concertId || typeof eloScore !== 'number') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { error } = await supabase
    .from('concerts')
    .update({ elo_score: Math.round(eloScore) })
    .eq('id', concertId)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: 'Failed to place concert' }, { status: 500 })
  }

  return NextResponse.json({ eloScore: Math.round(eloScore) })
}
