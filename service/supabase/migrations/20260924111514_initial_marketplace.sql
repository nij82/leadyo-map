-- Local-reviewed schema. No production data or demo identities.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;
create table private.member_access(id uuid primary key references auth.users(id), role text not null default 'recruiter' check(role in ('recruiter','admin')), status text not null default 'active' check(status in ('active','suspended')));
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select auth.uid() is not null and exists(select 1 from private.member_access where id=auth.uid() and role='admin' and status='active') $$;
create function private.active_member() returns boolean language sql stable security definer set search_path='' as $$ select auth.uid() is not null and exists(select 1 from private.member_access where id=auth.uid() and status='active') $$;
-- Only exposes a boolean, so public listings disappear immediately after suspension.
create function private.owner_active(owner uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from private.member_access where id=owner and status='active') $$;
revoke all on function private.is_admin(),private.active_member(),private.owner_active(uuid) from public;
grant execute on function private.is_admin(),private.active_member() to authenticated;
grant execute on function private.owner_active(uuid) to anon,authenticated;
create table public.profiles(id uuid primary key references auth.users(id), name text not null check(length(name) between 1 and 80),organization text not null check(length(organization) between 1 and 100),phone text not null check(phone ~ '^0[0-9-]{8,14}$'),legal_version text not null check(length(legal_version)>0),accepted_at timestamptz not null default now(),created_at timestamptz not null default now());
create function private.enroll_member() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or new.id<>auth.uid() or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verified email required';end if;
 new.accepted_at:=now();insert into private.member_access(id) values(new.id);return new;end $$;
create trigger enroll_member before insert on public.profiles for each row execute function private.enroll_member();
create table public.projects(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 150),address text not null check(length(address) between 1 and 300),latitude double precision not null check(latitude between 33 and 39),longitude double precision not null check(longitude between 124 and 132),units integer check(units>0),types text,price text,move_in text,deposit text,interim text,builder text,published boolean not null default false,created_at timestamptz not null default now());
create function private.valid_rates(value jsonb) returns boolean language plpgsql immutable set search_path='' as $$ declare item jsonb; seen text[]:='{}'; begin
 if jsonb_typeof(value)<>'array' or jsonb_array_length(value) not between 1 and 4 then return false;end if;
 for item in select * from jsonb_array_elements(value) loop
 if not (item ? 'amount') or not (item ? 'role') or coalesce(item->>'role','') not in ('member','leader','director','team') or item->>'role'=any(seen) then return false;end if;
 seen:=array_append(seen,item->>'role');
 if item->'amount'<>'null'::jsonb and (jsonb_typeof(item->'amount')<>'number' or (item->>'amount')::numeric<=0 or (item->>'amount')::numeric>100000) then return false;end if;
 end loop;return not ('team'=any(seen) and ('member'=any(seen) or 'leader'=any(seen)));exception when others then return false;end $$;
create table public.listings(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id),owner_id uuid not null references public.profiles(id),organization text not null check(length(organization) between 1 and 100),workplace text not null check(length(workplace) between 1 and 200),rates jsonb not null check(private.valid_rates(rates)),payment text not null check(length(payment) between 1 and 300),trigger_condition text not null check(length(trigger_condition) between 1 and 300),clawback text not null check(length(clawback) between 1 and 300),support text not null default '' check(length(support)<=1000),phone text not null check(phone ~ '^0[0-9-]{8,14}$'),phone_consent boolean not null check(phone_consent=true),phone_consented_at timestamptz not null default now(),kakao_url text check(kakao_url is null or kakao_url ~ '^https://open\.kakao\.com/o/[a-zA-Z0-9]+/?$'),status text not null default 'published' check(status in ('published','closed')),moderation text not null default 'visible' check(moderation in ('visible','hidden','deleted')),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index listing_project on public.listings(project_id);create index listing_owner on public.listings(owner_id);
create table public.site_requests(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),name text not null check(length(name) between 1 and 150),address text not null check(length(address) between 1 and 300),status text not null default 'pending' check(status in ('pending','resolved')),created_at timestamptz not null default now());
create table public.reports(id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.listings(id),reason text not null check(length(reason) between 1 and 1000),status text not null default 'pending' check(status in ('pending','resolved')),created_at timestamptz not null default now());
-- Public reporting must go through a rate-limited, CAPTCHA-verified server endpoint. No anon INSERT grants.
create table public.audit_logs(id bigint generated always as identity primary key,actor_id uuid not null references auth.users(id),action text not null,target_id uuid not null,reason text not null,created_at timestamptz not null default now());
create function private.guard_listing() returns trigger language plpgsql set search_path='' as $$ begin
 if TG_OP='INSERT' then
 if new.owner_id<>auth.uid() or new.moderation<>'visible' or new.status<>'published' then raise exception 'Invalid initial ownership or status';end if;
 new.created_at:=now();new.phone_consented_at:=now();
 else
 if new.owner_id<>old.owner_id or new.project_id<>old.project_id then raise exception 'Ownership and project are immutable';end if;
 if not private.is_admin() and (new.moderation<>old.moderation or old.moderation='deleted') then raise exception 'Moderation is operator-only';end if;
 new.created_at:=old.created_at;new.phone_consented_at:=case when new.phone<>old.phone then now() else old.phone_consented_at end;
 end if;new.updated_at:=now();return new;end $$;
create trigger guard_listing before insert or update on public.listings for each row execute function private.guard_listing();
create function public.am_i_admin() returns boolean language sql stable security invoker set search_path='' as $$ select private.is_admin() $$;
create function public.member_status() returns text language sql stable security definer set search_path='' as $$ select status from private.member_access where auth.uid() is not null and id=auth.uid() $$;
create function public.moderate_listing(target uuid,decision text,reason text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.is_admin() then raise exception 'Forbidden';end if;
 if decision not in ('visible','hidden','deleted') or length(trim(reason)) not between 1 and 1000 then raise exception 'Invalid decision';end if;
 if decision='visible' and not exists(select 1 from public.listings where id=target and private.owner_active(owner_id) and moderation<>'deleted') then raise exception 'Cannot publish suspended or deleted listing';end if;
 update public.listings set moderation=decision where id=target;
 if not found then raise exception 'Not found';end if;
 insert into public.audit_logs(actor_id,action,target_id,reason) values(auth.uid(),'listing:'||decision,target,trim(reason));end $$;
create function public.set_member_status(target uuid,decision text,reason text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.is_admin() then raise exception 'Forbidden';end if;
 if target=auth.uid() or decision not in ('active','suspended') or length(trim(reason)) not between 1 and 1000 then raise exception 'Invalid decision';end if;
 update private.member_access set status=decision where id=target and role<>'admin';if not found then raise exception 'Not found';end if;
 if decision='suspended' then update public.listings set moderation='hidden' where owner_id=target and moderation='visible';end if;
 insert into public.audit_logs(actor_id,action,target_id,reason) values(auth.uid(),'member:'||decision,target,trim(reason));end $$;
-- Explicit grants and row policies; role/status never come from user-editable metadata.
alter table public.profiles enable row level security;alter table public.projects enable row level security;alter table public.listings enable row level security;alter table public.site_requests enable row level security;alter table public.reports enable row level security;alter table public.audit_logs enable row level security;alter table private.member_access enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or private.is_admin());
create policy profiles_enroll on public.profiles for insert to authenticated with check(id=auth.uid());
create policy profiles_edit on public.profiles for update to authenticated using(id=auth.uid() and private.active_member()) with check(id=auth.uid());
create policy project_public on public.projects for select to anon,authenticated using(published);
create policy project_admin on public.projects for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy listing_public on public.listings for select to anon,authenticated using(status='published' and moderation='visible' and private.owner_active(owner_id) and exists(select 1 from public.projects where id=project_id and published));
create policy listing_owner_read on public.listings for select to authenticated using(owner_id=auth.uid() or private.is_admin());
create policy listing_create on public.listings for insert to authenticated with check(owner_id=auth.uid() and private.active_member() and exists(select 1 from public.projects where id=project_id and published));
create policy listing_edit on public.listings for update to authenticated using(owner_id=auth.uid() and private.active_member() and moderation<>'deleted') with check(owner_id=auth.uid() and private.active_member());
create policy request_read on public.site_requests for select to authenticated using(owner_id=auth.uid() or private.is_admin());
create policy request_create on public.site_requests for insert to authenticated with check(owner_id=auth.uid() and private.active_member() and status='pending');
create policy request_admin on public.site_requests for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy report_admin on public.reports for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy audit_admin on public.audit_logs for select to authenticated using(private.is_admin());
grant select on public.projects,public.listings to anon;
grant select,insert,update on public.profiles,public.projects,public.listings,public.site_requests,public.reports to authenticated;
grant select on public.audit_logs to authenticated;
revoke all on private.member_access from anon,authenticated;
revoke all on function public.am_i_admin(),public.member_status(),public.moderate_listing(uuid,text,text),public.set_member_status(uuid,text,text) from public;
grant execute on function public.am_i_admin(),public.member_status(),public.moderate_listing(uuid,text,text),public.set_member_status(uuid,text,text) to authenticated;
revoke all on function private.enroll_member(),private.guard_listing() from public;
revoke all on function private.valid_rates(jsonb) from public;
grant execute on function private.valid_rates(jsonb) to authenticated;
create function public.admin_members() returns table(id uuid,name text,organization text,status text,role text) language plpgsql stable security definer set search_path='' as $$ begin if not private.is_admin() then raise exception 'Forbidden';end if;return query select p.id,p.name,p.organization,a.status,a.role from public.profiles p join private.member_access a on a.id=p.id;end $$;
revoke all on function public.admin_members() from public;grant execute on function public.admin_members() to authenticated;
-- Consent timestamps/versions cannot be overwritten by profile editors.
revoke update on public.profiles from authenticated;grant update(name,organization,phone) on public.profiles to authenticated;
create function private.project_audit() returns trigger language plpgsql security definer set search_path='' as $$ begin if auth.uid() is null or not private.is_admin() then raise exception 'Forbidden';end if;insert into public.audit_logs(actor_id,action,target_id,reason) values(auth.uid(),'project:'||lower(TG_OP),new.id,'현장정보 저장');return new;end $$;
create trigger project_audit after insert or update on public.projects for each row execute function private.project_audit();
revoke all on function private.project_audit() from public;
