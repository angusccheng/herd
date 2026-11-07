alter table concerts
  add column if not exists media_urls text[] default '{}' not null;

insert into storage.buckets (id, name, public)
  values ('concert-media', 'concert-media', true)
  on conflict do nothing;

create policy "Concert media is publicly accessible"
  on storage.objects for select using (bucket_id = 'concert-media');

create policy "Users can upload their own concert media"
  on storage.objects for insert
  with check (bucket_id = 'concert-media' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own concert media"
  on storage.objects for delete
  using (bucket_id = 'concert-media' and auth.uid()::text = (storage.foldername(name))[1]);
