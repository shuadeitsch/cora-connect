-- Applied live as 004_preapproved_chief_admins. Idempotent.
-- Emails in preapproved_admins become approved admins with full permissions
-- when their profile row is inserted. They are the same kind of admin as any
-- other approved admin. This file does not add a role above admin.

create table if not exists public.preapproved_admins (
  email text primary key
);

alter table public.preapproved_admins enable row level security;

insert into public.preapproved_admins (email) values
  ('mendelgreisman@gmail.com'),
  ('info@chabadora.com')
on conflict do nothing;

create or replace function public.apply_preapproved_admin()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if exists (select 1 from public.preapproved_admins where email = lower(new.email)) then
    new.role := 'admin';
    new.status := 'approved';
    new.expires_at := null;
    new.can_view_history := true;
    new.can_view_contact := true;
    new.can_edit := true;
  end if;
  return new;
end;
$$;

drop trigger if exists zz_apply_preapproved_admin on public.profiles;
create trigger zz_apply_preapproved_admin
  before insert on public.profiles
  for each row
  execute function public.apply_preapproved_admin();
