-- 1.8.28: optional full-page background photo per user (Settings › Theme).
alter table public.profiles add column if not exists background_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backgrounds', 'backgrounds', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "backgrounds_read" on storage.objects;
create policy "backgrounds_read" on storage.objects for select to authenticated
  using (bucket_id = 'backgrounds');

-- Public read so the CSS background URL works without a cookie on every asset request.
drop policy if exists "backgrounds_read_public" on storage.objects;
create policy "backgrounds_read_public" on storage.objects for select to anon
  using (bucket_id = 'backgrounds');

drop policy if exists "backgrounds_insert_own" on storage.objects;
create policy "backgrounds_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "backgrounds_update_own" on storage.objects;
create policy "backgrounds_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "backgrounds_delete_own" on storage.objects;
create policy "backgrounds_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);
