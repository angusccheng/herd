create extension if not exists pg_trgm;

create table if not exists artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  status text not null default 'user_created',
  created_at timestamptz not null default now()
);

create table if not exists artist_aliases (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  alias text not null,
  normalized_alias text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  city text,
  normalized_city text,
  status text not null default 'user_created',
  created_at timestamptz not null default now(),
  unique (normalized_name, normalized_city)
);

create table if not exists venue_aliases (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  normalized_city text,
  created_at timestamptz not null default now(),
  unique (normalized_alias, normalized_city)
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text,
  normalized_name text,
  artist_id uuid references artists(id) on delete set null,
  venue_id uuid references venues(id) on delete set null,
  event_date date,
  city text,
  normalized_city text,
  status text not null default 'user_created',
  created_at timestamptz not null default now(),
  unique (normalized_name, artist_id, venue_id, event_date)
);

create table if not exists event_aliases (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  artist_id uuid references artists(id) on delete cascade,
  venue_id uuid references venues(id) on delete cascade,
  event_date date,
  created_at timestamptz not null default now(),
  unique (normalized_alias, artist_id, venue_id, event_date)
);

alter table concerts
  add column if not exists artist_id uuid references artists(id) on delete set null,
  add column if not exists venue_id uuid references venues(id) on delete set null,
  add column if not exists event_id uuid references events(id) on delete set null,
  add column if not exists event_name text;

create index if not exists artists_normalized_name_trgm_idx
  on artists using gin (normalized_name gin_trgm_ops);

create index if not exists artist_aliases_normalized_alias_trgm_idx
  on artist_aliases using gin (normalized_alias gin_trgm_ops);

create index if not exists venues_normalized_name_trgm_idx
  on venues using gin (normalized_name gin_trgm_ops);

create index if not exists venue_aliases_normalized_alias_trgm_idx
  on venue_aliases using gin (normalized_alias gin_trgm_ops);

create index if not exists events_lookup_idx
  on events (artist_id, venue_id, event_date);

insert into artists (name, normalized_name, status)
values
  ('SZA', 'sza', 'seeded'),
  ('Drake', 'drake', 'seeded'),
  ('Taylor Swift', 'taylor swift', 'seeded'),
  ('Beyonce', 'beyonce', 'seeded'),
  ('Bad Bunny', 'bad bunny', 'seeded'),
  ('The Weeknd', 'the weeknd', 'seeded'),
  ('Frank Ocean', 'frank ocean', 'seeded'),
  ('Tyler, The Creator', 'tyler the creator', 'seeded'),
  ('Kendrick Lamar', 'kendrick lamar', 'seeded'),
  ('Olivia Rodrigo', 'olivia rodrigo', 'seeded'),
  ('Billie Eilish', 'billie eilish', 'seeded'),
  ('Radiohead', 'radiohead', 'seeded'),
  ('The Marias', 'the marias', 'seeded'),
  ('d4vd', 'd4vd', 'seeded'),
  ('Wave to Earth', 'wave to earth', 'seeded')
on conflict (normalized_name) do nothing;

insert into artist_aliases (artist_id, alias, normalized_alias)
select id, 'sza', 'sza' from artists where normalized_name = 'sza'
on conflict (normalized_alias) do nothing;

insert into artist_aliases (artist_id, alias, normalized_alias)
select id, 'marias', 'marias' from artists where normalized_name = 'the marias'
on conflict (normalized_alias) do nothing;

insert into artist_aliases (artist_id, alias, normalized_alias)
select id, 'w2e', 'w2e' from artists where normalized_name = 'wave to earth'
on conflict (normalized_alias) do nothing;

insert into venues (name, normalized_name, city, normalized_city, status)
values
  ('Madison Square Garden', 'madison square garden', 'New York', 'new york', 'seeded'),
  ('Barclays Center', 'barclays center', 'New York', 'new york', 'seeded'),
  ('Terminal 5', 'terminal 5', 'New York', 'new york', 'seeded'),
  ('Brooklyn Steel', 'brooklyn steel', 'New York', 'new york', 'seeded'),
  ('Radio City Music Hall', 'radio city music hall', 'New York', 'new york', 'seeded'),
  ('Webster Hall', 'webster hall', 'New York', 'new york', 'seeded'),
  ('Bowery Ballroom', 'bowery ballroom', 'New York', 'new york', 'seeded'),
  ('Music Hall of Williamsburg', 'music hall of williamsburg', 'New York', 'new york', 'seeded'),
  ('Prudential Center', 'prudential center', 'Newark', 'newark', 'seeded'),
  ('MetLife Stadium', 'metlife stadium', 'East Rutherford', 'east rutherford', 'seeded'),
  ('Staples Center', 'staples center', 'Los Angeles', 'los angeles', 'seeded')
on conflict (normalized_name, normalized_city) do nothing;

insert into venue_aliases (venue_id, alias, normalized_alias, normalized_city)
select id, 'MSG', 'msg', normalized_city from venues where normalized_name = 'madison square garden'
on conflict (normalized_alias, normalized_city) do nothing;

insert into venue_aliases (venue_id, alias, normalized_alias, normalized_city)
select id, 'madsion square garden', 'madsion square garden', normalized_city from venues where normalized_name = 'madison square garden'
on conflict (normalized_alias, normalized_city) do nothing;

insert into venue_aliases (venue_id, alias, normalized_alias, normalized_city)
select id, 'staples', 'staples', normalized_city from venues where normalized_name = 'staples center'
on conflict (normalized_alias, normalized_city) do nothing;
