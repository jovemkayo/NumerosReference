-- Fotos das colaboradoras em bucket privado.

alter table public.employees
add column if not exists photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-photos',
  'employee-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "employee_photos_select_auth" on storage.objects;
drop policy if exists "employee_photos_insert_admin" on storage.objects;
drop policy if exists "employee_photos_update_admin" on storage.objects;
drop policy if exists "employee_photos_delete_admin" on storage.objects;

create policy "employee_photos_select_auth"
on storage.objects
for select
to authenticated
using (bucket_id = 'employee-photos');

create policy "employee_photos_insert_admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'employee-photos'
  and public.has_role((select auth.uid()), 'admin')
);

create policy "employee_photos_update_admin"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'employee-photos'
  and public.has_role((select auth.uid()), 'admin')
)
with check (
  bucket_id = 'employee-photos'
  and public.has_role((select auth.uid()), 'admin')
);

create policy "employee_photos_delete_admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'employee-photos'
  and public.has_role((select auth.uid()), 'admin')
);
