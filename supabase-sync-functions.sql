-- SMART SYST'M PILOT — synchronisation avec contrôle de version
-- À exécuter dans Supabase SQL Editor après la création initiale des tables.
-- Ces fonctions ne déclenchent pas encore la synchronisation de l'application.

create or replace function public.ssp_save_record(
  p_company_id uuid,
  p_collection text,
  p_record_id text,
  p_payload jsonb,
  p_expected_version bigint default 0
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved_version bigint;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if not public.ssp_is_company_member(p_company_id) then
    raise exception 'Accès refusé à cette entreprise';
  end if;
  if p_collection is null or length(trim(p_collection)) = 0
     or p_record_id is null or length(trim(p_record_id)) = 0 then
    raise exception 'Collection et identifiant obligatoires';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Le contenu doit être un objet JSON';
  end if;
  if p_expected_version is null or p_expected_version < 0 then
    raise exception 'Version attendue invalide';
  end if;

  if p_expected_version = 0 then
    insert into public.ssp_app_records
      (company_id, collection, record_id, payload, version, updated_at, updated_by, deleted_at)
    values
      (p_company_id, trim(p_collection), trim(p_record_id), p_payload, 1, now(), auth.uid(), null)
    on conflict (company_id, collection, record_id) do nothing
    returning version into saved_version;
  else
    update public.ssp_app_records
       set payload = p_payload,
           version = version + 1,
           updated_at = now(),
           updated_by = auth.uid(),
           deleted_at = null
     where company_id = p_company_id
       and collection = trim(p_collection)
       and record_id = trim(p_record_id)
       and version = p_expected_version
    returning version into saved_version;
  end if;

  if saved_version is null then
    raise exception 'SSP_CONFLICT: cette fiche a été modifiée ailleurs. Rechargez-la avant de réessayer.';
  end if;

  return saved_version;
end;
$$;

create or replace function public.ssp_soft_delete_record(
  p_company_id uuid,
  p_collection text,
  p_record_id text,
  p_expected_version bigint
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved_version bigint;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if not public.ssp_is_company_member(p_company_id) then
    raise exception 'Accès refusé à cette entreprise';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'Version attendue invalide';
  end if;

  update public.ssp_app_records
     set version = version + 1,
         updated_at = now(),
         updated_by = auth.uid(),
         deleted_at = now()
   where company_id = p_company_id
     and collection = trim(p_collection)
     and record_id = trim(p_record_id)
     and version = p_expected_version
     and deleted_at is null
  returning version into saved_version;

  if saved_version is null then
    raise exception 'SSP_CONFLICT: cette fiche a été modifiée ailleurs. Rechargez-la avant de réessayer.';
  end if;

  return saved_version;
end;
$$;

revoke all on function public.ssp_save_record(uuid, text, text, jsonb, bigint) from public, anon;
revoke all on function public.ssp_soft_delete_record(uuid, text, text, bigint) from public, anon;
grant execute on function public.ssp_save_record(uuid, text, text, jsonb, bigint) to authenticated;
grant execute on function public.ssp_soft_delete_record(uuid, text, text, bigint) to authenticated;
