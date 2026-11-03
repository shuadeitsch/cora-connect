-- Let a person who can log a visit write that visit onto contact history.
-- Run after 011_normalize_contact_tags.sql. Safe to run again. Does not edit earlier files.
-- Do not apply this from the app. Run it in the Supabase SQL editor.
--
-- public.visits already allows insert when can_log_visit() and can_see_household().
-- public.contact_visits required can_edit_household(), so a shliach could log a
-- visit on a shared contact he does not own, and that row never reached Visit History.
-- History reads contact_visits. The season ("Summer 5786") is the visited column.

drop policy if exists contact_visits_insert on public.contact_visits;
drop policy if exists contact_visits_update on public.contact_visits;

create policy contact_visits_insert on public.contact_visits
  for insert to authenticated
  with check (
    org_id = public.my_org_id()
    and public.can_see_household(household_id)
    and (public.can_edit_household(household_id) or public.can_log_visit())
  );

create policy contact_visits_update on public.contact_visits
  for update to authenticated
  using (
    org_id = public.my_org_id()
    and public.can_see_household(household_id)
    and (
      public.can_edit_household(household_id)
      or (public.can_log_visit() and created_by = auth.uid())
    )
  )
  with check (
    org_id = public.my_org_id()
    and public.can_see_household(household_id)
    and (
      public.can_edit_household(household_id)
      or (public.can_log_visit() and created_by = auth.uid())
    )
  );
