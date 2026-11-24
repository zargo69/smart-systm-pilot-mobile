-- SMART SYST'M PILOT — droits de l’entreprise et réglages réservés au responsable
-- À appliquer uniquement après validation et pendant la mise en service.
-- Ne modifie ni les utilisateurs, ni les données existantes.

-- Une seule entreprise est autorisée pour cette installation. Le responsable crée le premier espace;
-- les autres comptes doivent être ajoutés par invitation avant leur première connexion.
create or replace function public.ssp_create_company(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $
declare
  new_company_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120 then
    raise exception 'Nom d’entreprise invalide';
  end if;

  select company_id into new_company_id
    from public.ssp_company_members
   where user_id = auth.uid()
   limit 1;
  if new_company_id is not null then return new_company_id; end if;

  perform pg_advisory_xact_lock(hashtext('ssp-single-company-installation')::bigint);
  if exists (select 1 from public.ssp_companies) then
    raise exception using message = 'SSP_COMPANY_ALREADY_EXISTS';
  end if;

  insert into public.ssp_companies (id, name, created_by)
  values (gen_random_uuid(), trim(p_name), auth.uid())
  returning id into new_company_id;

  insert into public.ssp_company_members (company_id, user_id, role)
  values (new_company_id, auth.uid(), 'admin');
  return new_company_id;
end;
$;

revoke all on function public.ssp_create_company(text) from public, anon;
grant execute on function public.ssp_create_company(text) to authenticated;

create or replace function public.ssp_is_company_admin(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ssp_company_members m
    where m.company_id = p_company_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  );
$$;

revoke all on function public.ssp_is_company_admin(uuid) from public, anon;
grant execute on function public.ssp_is_company_admin(uuid) to authenticated;

-- Les dossiers restent partagés et modifiables par tous les membres.
-- Seul le responsable peut modifier ou supprimer l'enregistrement des réglages.
drop policy if exists ssp_app_records_insert_member on public.ssp_app_records;
create policy ssp_app_records_insert_member
  on public.ssp_app_records for insert to authenticated
  with check (
    public.ssp_is_company_member(company_id)
    and updated_by = auth.uid()
    and (lower(trim(collection)) <> 'settings' or public.ssp_is_company_admin(company_id))
  );

drop policy if exists ssp_app_records_update_member on public.ssp_app_records;
create policy ssp_app_records_update_member
  on public.ssp_app_records for update to authenticated
  using (
    public.ssp_is_company_member(company_id)
    and (lower(trim(collection)) <> 'settings' or public.ssp_is_company_admin(company_id))
  )
  with check (
    public.ssp_is_company_member(company_id)
    and updated_by = auth.uid()
    and (lower(trim(collection)) <> 'settings' or public.ssp_is_company_admin(company_id))
  );

drop policy if exists ssp_app_records_delete_member on public.ssp_app_records;
create policy ssp_app_records_delete_member
  on public.ssp_app_records for delete to authenticated
  using (
    public.ssp_is_company_member(company_id)
    and (lower(trim(collection)) <> 'settings' or public.ssp_is_company_admin(company_id))
  );

-- L'administration des membres passe par la fonction serveur dédiée et sa clé secrète,
-- jamais par des écritures directes depuis le navigateur.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'ssp_company_members'
       and cmd in ('INSERT','UPDATE','DELETE','ALL')
  loop
    execute format('drop policy if exists %I on public.ssp_company_members', p.policyname);
  end loop;
end $$;

-- Les membres peuvent consulter les informations de leur entreprise, seul l'admin peut les changer.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'ssp_companies'
       and cmd in ('UPDATE','ALL')
  loop
    execute format('drop policy if exists %I on public.ssp_companies', p.policyname);
  end loop;
end $$;

create policy ssp_companies_update_admin
  on public.ssp_companies for update to authenticated
  using (public.ssp_is_company_admin(id))
  with check (public.ssp_is_company_admin(id));

-- Vérifications de sécurité indispensables.
do $$
begin
  if to_regprocedure('public.ssp_create_company(text)') is null then
    raise exception 'Fonction ssp_create_company absente';
  end if;
  if to_regprocedure('public.ssp_is_company_admin(uuid)') is null then
    raise exception 'Fonction ssp_is_company_admin absente';
  end if;
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'ssp_app_records'
       and policyname = 'ssp_app_records_update_member'
  ) then raise exception 'Politique de modification des dossiers absente'; end if;
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'ssp_companies'
       and policyname = 'ssp_companies_update_admin'
  ) then raise exception 'Politique admin entreprise absente'; end if;
end $$;
