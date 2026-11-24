-- Read-only structural checks for SMART SYST'M PILOT.
-- This query returns schema metadata only; it never reads application records.

with checks (check_name, ok, detail) as (
  values
    (
      'Table ssp_app_records',
      to_regclass('public.ssp_app_records') is not null,
      'Table métier distante présente'
    ),
    (
      'RLS ssp_app_records',
      coalesce((
        select c.relrowsecurity
        from pg_class c
        where c.oid = to_regclass('public.ssp_app_records')
      ), false),
      'Row Level Security activé'
    ),
    (
      'Politiques RLS métier',
      (
        select count(*) = 4
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = 'ssp_app_records'
          and p.policyname in (
            'ssp_app_records_select_member',
            'ssp_app_records_insert_member',
            'ssp_app_records_update_member',
            'ssp_app_records_delete_member'
          )
      ),
      'Quatre politiques d’accès entreprise attendues'
    ),
    (
      'RPC ssp_is_company_member',
      to_regprocedure('public.ssp_is_company_member(uuid)') is not null,
      'Fonction de contrôle d’appartenance présente'
    ),
    (
      'RPC ssp_save_record',
      to_regprocedure('public.ssp_save_record(uuid,text,text,jsonb,bigint)') is not null,
      'Fonction versionnée présente'
    ),
    (
      'RPC ssp_soft_delete_record',
      to_regprocedure('public.ssp_soft_delete_record(uuid,text,text,bigint)') is not null,
      'Fonction de suppression logique présente'
    ),
    (
      'Bucket privé ssp-company-files',
      exists (
        select 1
        from storage.buckets b
        where b.id = 'ssp-company-files'
          and b.public = false
      ),
      'Bucket absent ou non privé'
    ),
    (
      'Politiques RLS des fichiers',
      (
        select count(*) = 4
        from pg_policies p
        where p.schemaname = 'storage'
          and p.tablename = 'objects'
          and p.policyname in (
            'ssp_company_files_select_member',
            'ssp_company_files_insert_member',
            'ssp_company_files_update_member',
            'ssp_company_files_delete_member'
          )
      ),
      'Quatre politiques d’accès fichier attendues'
    )
)
select
  check_name,
  case when ok then 'OK' else 'À vérifier' end as resultat,
  detail
from checks
order by check_name;
