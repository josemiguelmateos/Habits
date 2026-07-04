-- ============================================================
-- 0002 — Bucket privado exercise-media
-- Fotos de ejercicios, path: {user_id}/{exercise_id}.webp
-- Bucket PRIVADO: la app lee con URLs firmadas.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-media',
  'exercise-media',
  false,
  2097152, -- 2 MB: la foto llega ya comprimida del cliente (~150-300 KB)
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- Cada usuario solo opera dentro de su propia carpeta {user_id}/...
create policy "exercise_media_select_own" on storage.objects
  for select using (
    bucket_id = 'exercise-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "exercise_media_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'exercise-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "exercise_media_update_own" on storage.objects
  for update using (
    bucket_id = 'exercise-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "exercise_media_delete_own" on storage.objects
  for delete using (
    bucket_id = 'exercise-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
