-- Add bucket and rank_position columns
ALTER TABLE concerts ADD COLUMN IF NOT EXISTS bucket text;
ALTER TABLE concerts ADD COLUMN IF NOT EXISTS rank_position integer;

-- Migrate existing elo_score data into bucket + rank_position
UPDATE concerts SET bucket = CASE
  WHEN elo_score >= 1060 THEN 'liked'
  WHEN elo_score >= 940  THEN 'fine'
  ELSE 'didnt'
END
WHERE bucket IS NULL;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, bucket
           ORDER BY elo_score DESC
         ) AS rn
  FROM concerts
  WHERE rank_position IS NULL
)
UPDATE concerts
SET rank_position = ranked.rn
FROM ranked
WHERE concerts.id = ranked.id;
