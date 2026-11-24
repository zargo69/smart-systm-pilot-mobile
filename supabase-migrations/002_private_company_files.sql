-- SMART SYST'M PILOT — fichiers privés par entreprise
-- Bucket privé : accès uniquement via politiques Storage et URL signées courtes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ssp-company-files',
  'ssp-company-files',
  false,
  15728640,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ssp_company_files_select_member" on storage.objects;
create policy "ssp_company_files_select_member"
on storage.objects for select to authenticated
using (
  bucket_id = 'ssp-company-files'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.ssp_is_company_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "ssp_company_files_insert_member" on storage.objects;
create policy "ssp_company_files_insert_member"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ssp-company-files'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.ssp_is_company_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "ssp_company_files_update_member" on storage.objects;
create policy "ssp_company_files_update_member"
on storage.objects for update to authenticated
using (
  bucket_id = 'ssp-company-files'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.ssp_is_company_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'ssp-company-files'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.ssp_is_company_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "ssp_company_files_delete_member" on storage.objects;
create policy "ssp_company_files_delete_member"
on storage.objects for delete to authenticated
using (
  bucket_id = 'ssp-company-files'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.ssp_is_company_member(((storage.foldername(name))[1])::uuid)
);
