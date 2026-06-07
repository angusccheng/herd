import type { Concert } from './supabase'

export type SentimentBucket = 'liked' | 'fine' | 'didnt'

export const SENTIMENT_BUCKETS: Record<SentimentBucket, {
  label: string
  shortLabel: string
  scoreRange: { min: number; max: number }
}> = {
  liked: {
    label: 'I liked it',
    shortLabel: 'Liked',
    scoreRange: { min: 7.0, max: 10.0 },
  },
  fine: {
    label: 'It was fine',
    shortLabel: 'Fine',
    scoreRange: { min: 4.0, max: 7.0 },
  },
  didnt: {
    label: "I didn't like it",
    shortLabel: 'Did not like',
    scoreRange: { min: 0.0, max: 4.0 },
  },
}

export function isSentimentBucket(value: string | null): value is SentimentBucket {
  return value === 'liked' || value === 'fine' || value === 'didnt'
}

export function getConcertBucket(concert: Concert): SentimentBucket {
  return concert.bucket
}

export function getRatingDisplay(bucket: SentimentBucket, rankPosition: number, total: number): string {
  const { min, max } = SENTIMENT_BUCKETS[bucket].scoreRange
  if (total <= 1) return ((min + max) / 2).toFixed(1)
  const score = max - ((max - min) / (total - 1)) * (rankPosition - 1)
  return Math.min(max, Math.max(min, score)).toFixed(1)
}

export function getRatingColor(bucket: SentimentBucket) {
  if (bucket === 'liked') return 'var(--good)'
  if (bucket === 'fine') return 'var(--okay)'
  return 'var(--bad)'
}

export function getRatingLabel(bucket: SentimentBucket, rankPosition: number, total: number) {
  const score = parseFloat(getRatingDisplay(bucket, rankPosition, total))
  if (score >= 9.0) return 'All-time favorite'
  if (score >= 7.0) return 'Liked'
  if (score >= 5.5) return 'Solid'
  if (score >= 4.0) return 'Fine'
  return 'Not your thing'
}

const BUCKET_ORDER: Record<SentimentBucket, number> = { liked: 0, fine: 1, didnt: 2 }

export function sortConcerts(concerts: Concert[]): Concert[] {
  return [...concerts].sort((a, b) => {
    const bucketDiff = BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket]
    if (bucketDiff !== 0) return bucketDiff
    return (a.rank_position ?? 0) - (b.rank_position ?? 0)
  })
}
