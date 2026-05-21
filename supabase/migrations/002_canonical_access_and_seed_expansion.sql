alter table artists enable row level security;
alter table artist_aliases enable row level security;
alter table venues enable row level security;
alter table venue_aliases enable row level security;
alter table events enable row level security;
alter table event_aliases enable row level security;

drop policy if exists "artists_select_public" on artists;
create policy "artists_select_public"
  on artists for select
  using (true);

drop policy if exists "artists_insert_public" on artists;
create policy "artists_insert_public"
  on artists for insert
  with check (length(trim(name)) > 0 and length(trim(normalized_name)) > 0);

drop policy if exists "artist_aliases_select_public" on artist_aliases;
create policy "artist_aliases_select_public"
  on artist_aliases for select
  using (true);

drop policy if exists "artist_aliases_insert_public" on artist_aliases;
create policy "artist_aliases_insert_public"
  on artist_aliases for insert
  with check (length(trim(alias)) > 0 and length(trim(normalized_alias)) > 0);

drop policy if exists "venues_select_public" on venues;
create policy "venues_select_public"
  on venues for select
  using (true);

drop policy if exists "venues_insert_public" on venues;
create policy "venues_insert_public"
  on venues for insert
  with check (length(trim(name)) > 0 and length(trim(normalized_name)) > 0);

drop policy if exists "venue_aliases_select_public" on venue_aliases;
create policy "venue_aliases_select_public"
  on venue_aliases for select
  using (true);

drop policy if exists "venue_aliases_insert_public" on venue_aliases;
create policy "venue_aliases_insert_public"
  on venue_aliases for insert
  with check (length(trim(alias)) > 0 and length(trim(normalized_alias)) > 0);

drop policy if exists "events_select_public" on events;
create policy "events_select_public"
  on events for select
  using (true);

drop policy if exists "events_insert_public" on events;
create policy "events_insert_public"
  on events for insert
  with check (true);

drop policy if exists "event_aliases_select_public" on event_aliases;
create policy "event_aliases_select_public"
  on event_aliases for select
  using (true);

drop policy if exists "event_aliases_insert_public" on event_aliases;
create policy "event_aliases_insert_public"
  on event_aliases for insert
  with check (length(trim(alias)) > 0 and length(trim(normalized_alias)) > 0);

insert into artists (name, normalized_name, status)
values
  ('Adele', 'adele', 'seeded'),
  ('Ariana Grande', 'ariana grande', 'seeded'),
  ('beabadoobee', 'beabadoobee', 'seeded'),
  ('Benson Boone', 'benson boone', 'seeded'),
  ('Bruno Mars', 'bruno mars', 'seeded'),
  ('Charli XCX', 'charli xcx', 'seeded'),
  ('Chappell Roan', 'chappell roan', 'seeded'),
  ('Clairo', 'clairo', 'seeded'),
  ('Coldplay', 'coldplay', 'seeded'),
  ('Daniel Caesar', 'daniel caesar', 'seeded'),
  ('Doja Cat', 'doja cat', 'seeded'),
  ('Dua Lipa', 'dua lipa', 'seeded'),
  ('Ed Sheeran', 'ed sheeran', 'seeded'),
  ('Faye Webster', 'faye webster', 'seeded'),
  ('Gracie Abrams', 'gracie abrams', 'seeded'),
  ('Harry Styles', 'harry styles', 'seeded'),
  ('Hozier', 'hozier', 'seeded'),
  ('Ivan Cornejo', 'ivan cornejo', 'seeded'),
  ('J. Cole', 'j cole', 'seeded'),
  ('Joji', 'joji', 'seeded'),
  ('Karol G', 'karol g', 'seeded'),
  ('Lana Del Rey', 'lana del rey', 'seeded'),
  ('Laufey', 'laufey', 'seeded'),
  ('Lizzy McAlpine', 'lizzy mcalpine', 'seeded'),
  ('Mitski', 'mitski', 'seeded'),
  ('Morgan Wallen', 'morgan wallen', 'seeded'),
  ('NewJeans', 'newjeans', 'seeded'),
  ('Noah Kahan', 'noah kahan', 'seeded'),
  ('Omar Apollo', 'omar apollo', 'seeded'),
  ('Phoebe Bridgers', 'phoebe bridgers', 'seeded'),
  ('Post Malone', 'post malone', 'seeded'),
  ('Ravyn Lenae', 'ravyn lenae', 'seeded'),
  ('Reneé Rapp', 'renee rapp', 'seeded'),
  ('Rihanna', 'rihanna', 'seeded'),
  ('Sabrina Carpenter', 'sabrina carpenter', 'seeded'),
  ('Steve Lacy', 'steve lacy', 'seeded'),
  ('Tate McRae', 'tate mcrae', 'seeded'),
  ('Travis Scott', 'travis scott', 'seeded'),
  ('Troye Sivan', 'troye sivan', 'seeded'),
  ('Zach Bryan', 'zach bryan', 'seeded')
on conflict (normalized_name) do update
set
  name = excluded.name,
  status = case
    when artists.status = 'user_created' then excluded.status
    else artists.status
  end;

insert into artist_aliases (artist_id, alias, normalized_alias)
select id, alias, normalized_alias
from artists
join (
  values
    ('beabadoobee', 'Bea', 'bea'),
    ('charli xcx', 'Charli', 'charli'),
    ('j cole', 'J Cole', 'j cole'),
    ('newjeans', 'New Jeans', 'new jeans'),
    ('renee rapp', 'Renee Rapp', 'renee rapp'),
    ('the weeknd', 'The Weekend', 'the weekend'),
    ('tyler the creator', 'Tyler the Creator', 'tyler the creator')
) as aliases(normalized_name, alias, normalized_alias)
  on artists.normalized_name = aliases.normalized_name
on conflict (normalized_alias) do nothing;

insert into venues (name, normalized_name, city, normalized_city, status)
values
  ('Beacon Theatre', 'beacon theatre', 'New York', 'new york', 'seeded'),
  ('Blue Note New York', 'blue note new york', 'New York', 'new york', 'seeded'),
  ('Forest Hills Stadium', 'forest hills stadium', 'New York', 'new york', 'seeded'),
  ('Irving Plaza', 'irving plaza', 'New York', 'new york', 'seeded'),
  ('Jones Beach Theater', 'jones beach theater', 'Wantagh', 'wantagh', 'seeded'),
  ('Kings Theatre', 'kings theatre', 'Brooklyn', 'brooklyn', 'seeded'),
  ('Knockdown Center', 'knockdown center', 'Queens', 'queens', 'seeded'),
  ('Mercury Lounge', 'mercury lounge', 'New York', 'new york', 'seeded'),
  ('The Rooftop at Pier 17', 'the rooftop at pier 17', 'New York', 'new york', 'seeded'),
  ('UBS Arena', 'ubs arena', 'Elmont', 'elmont', 'seeded'),
  ('United Palace', 'united palace', 'New York', 'new york', 'seeded'),
  ('YouTube Theater', 'youtube theater', 'Inglewood', 'inglewood', 'seeded'),
  ('Hollywood Bowl', 'hollywood bowl', 'Los Angeles', 'los angeles', 'seeded'),
  ('The Greek Theatre', 'the greek theatre', 'Los Angeles', 'los angeles', 'seeded'),
  ('The Wiltern', 'the wiltern', 'Los Angeles', 'los angeles', 'seeded'),
  ('The Fillmore', 'the fillmore', 'San Francisco', 'san francisco', 'seeded'),
  ('Chase Center', 'chase center', 'San Francisco', 'san francisco', 'seeded'),
  ('United Center', 'united center', 'Chicago', 'chicago', 'seeded'),
  ('The Salt Shed', 'the salt shed', 'Chicago', 'chicago', 'seeded'),
  ('House of Blues Chicago', 'house of blues chicago', 'Chicago', 'chicago', 'seeded')
on conflict (normalized_name, normalized_city) do update
set
  name = excluded.name,
  city = excluded.city,
  status = case
    when venues.status = 'user_created' then excluded.status
    else venues.status
  end;

insert into venue_aliases (venue_id, alias, normalized_alias, normalized_city)
select id, alias, normalized_alias, venues.normalized_city
from venues
join (
  values
    ('forest hills stadium', 'Forest Hills', 'forest hills'),
    ('jones beach theater', 'Jones Beach', 'jones beach'),
    ('the rooftop at pier 17', 'Pier 17', 'pier 17'),
    ('ubs arena', 'UBS', 'ubs'),
    ('youtube theater', 'YouTube Theatre', 'youtube theatre'),
    ('the greek theatre', 'Greek Theatre', 'greek theatre'),
    ('the wiltern', 'Wiltern', 'wiltern'),
    ('the salt shed', 'Salt Shed', 'salt shed')
) as aliases(normalized_name, alias, normalized_alias)
  on venues.normalized_name = aliases.normalized_name
on conflict (normalized_alias, normalized_city) do nothing;
