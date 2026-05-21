import type { Concert } from './supabase'

export type SentimentBucket = 'liked' | 'fine' | 'didnt'

export const SENTIMENT_BUCKETS: Record<SentimentBucket, {
  label: string
  shortLabel: string
  score: number
}> = {
  liked: {
    label: 'I liked it',
    shortLabel: 'Liked',
    score: 1080,
  },
  fine: {
    label: 'It was fine',
    shortLabel: 'Fine',
    score: 1000,
  },
  didnt: {
    label: "I didn't like it",
    shortLabel: 'Did not like',
    score: 920,
  },
}

const BUCKET_RANGES: Record<SentimentBucket, { min: number; max: number }> = {
  liked: { min: 1060, max: 1240 },
  fine: { min: 940, max: 1059 },
  didnt: { min: 760, max: 939 },
}

export function getBucketForScore(score: number): SentimentBucket {
  if (score >= BUCKET_RANGES.liked.min) return 'liked'
  if (score >= BUCKET_RANGES.fine.min) return 'fine'
  return 'didnt'
}

export function getBucketRange(bucket: SentimentBucket) {
  return BUCKET_RANGES[bucket]
}

export function isSentimentBucket(value: string | null): value is SentimentBucket {
  return value === 'liked' || value === 'fine' || value === 'didnt'
}

export function getConcertBucket(concert: Concert) {
  return getBucketForScore(concert.elo_score)
}

export function getRatingDisplay(score: number) {
  const raw = ((score - 800) / 400) * 9 + 1
  const clamped = Math.min(10, Math.max(1, raw))
  return clamped.toFixed(1)
}

export function getRatingColor(score: number) {
  const bucket = getBucketForScore(score)
  if (bucket === 'liked') return 'var(--good)'
  if (bucket === 'fine') return 'var(--okay)'
  return 'var(--bad)'
}

export function getRatingLabel(score: number) {
  if (score >= 1120) return 'All-time favorite'
  if (score >= 1060) return 'Liked'
  if (score >= 1000) return 'Solid'
  if (score >= 940) return 'Fine'
  return 'Not your thing'
}

export function scoreForPlacement(pool: Concert[], insertionIndex: number, bucket: SentimentBucket) {
  if (pool.length === 0) {
    return SENTIMENT_BUCKETS[bucket].score
  }

  return scoreForRank(bucket, insertionIndex, pool.length + 1)
}

export function scoreForRank(bucket: SentimentBucket, rankIndex: number, totalCount: number) {
  const range = getBucketRange(bucket)

  if (totalCount <= 1) {
    return SENTIMENT_BUCKETS[bucket].score
  }

  const clampedIndex = Math.min(totalCount - 1, Math.max(0, rankIndex))
  const step = (range.max - range.min) / totalCount
  const score = range.max - (step * clampedIndex)
  return Math.round(Math.min(range.max, Math.max(range.min, score)))
}
