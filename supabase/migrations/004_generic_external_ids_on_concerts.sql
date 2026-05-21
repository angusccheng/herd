alter table concerts
  add column if not exists event_external_id text,
  add column if not exists event_external_source text,
  add column if not exists artist_external_id text,
  add column if not exists artist_external_source text,
  add column if not exists venue_external_id text,
  add column if not exists venue_external_source text;

create index if not exists concerts_event_external_idx
  on concerts (event_external_source, event_external_id);

create index if not exists concerts_artist_external_idx
  on concerts (artist_external_source, artist_external_id);

create index if not exists concerts_venue_external_idx
  on concerts (venue_external_source, venue_external_id);
