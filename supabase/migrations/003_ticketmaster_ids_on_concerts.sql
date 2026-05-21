alter table concerts
  add column if not exists ticketmaster_event_id text,
  add column if not exists ticketmaster_artist_id text,
  add column if not exists ticketmaster_venue_id text;

create index if not exists concerts_ticketmaster_event_idx
  on concerts (ticketmaster_event_id);

create index if not exists concerts_ticketmaster_artist_idx
  on concerts (ticketmaster_artist_id);

create index if not exists concerts_ticketmaster_venue_idx
  on concerts (ticketmaster_venue_id);
