import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculateElo } from '@/lib/elo'

// This runs on the server, so we use the service role key for direct DB access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const { winnerId, loserId, userId } = await req.json()

  if (!winnerId || !loserId || !userId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // 1. Fetch both concerts
  const { data: concerts, error: fetchError } = await supabase
    .from('concerts')
    .select('id, elo_score')
    .in('id', [winnerId, loserId])

  if (fetchError || !concerts || concerts.length !== 2) {
    return NextResponse.json({ error: 'Could not fetch concerts' }, { status: 500 })
  }

  const winner = concerts.find(c => c.id === winnerId)!
  const loser = concerts.find(c => c.id === loserId)!

  // 2. Calculate new Elo scores
  const { winnerNewScore, loserNewScore, change } = calculateElo(
    winner.elo_score,
    loser.elo_score
  )

  // 3. Update winner's score
  const { error: winnerError } = await supabase
    .from('concerts')
    .update({ elo_score: winnerNewScore })
    .eq('id', winnerId)

  // 4. Update loser's score
  const { error: loserError } = await supabase
    .from('concerts')
    .update({ elo_score: loserNewScore })
    .eq('id', loserId)

  if (winnerError || loserError) {
    return NextResponse.json({ error: 'Failed to update scores' }, { status: 500 })
  }

  // 5. Log the comparison for history
  await supabase.from('comparisons').insert({
    user_id: userId,
    winner_id: winnerId,
    loser_id: loserId,
    winner_elo_before: winner.elo_score,
    loser_elo_before: loser.elo_score,
    winner_elo_after: winnerNewScore,
    loser_elo_after: loserNewScore,
  })

  return NextResponse.json({ winnerNewScore, loserNewScore, change })
}
