-- 1.8.41: opt-in Tutorial progress, per user. Clients may update their own row (existing profiles_update RLS).
alter table public.profiles
  add column if not exists tutorial_step integer not null default 0,
  add column if not exists tutorial_done boolean not null default false;

comment on column public.profiles.tutorial_step is 'Index of the in-progress Tutorial walkthrough step (0-based). Used to resume after Exit.';
comment on column public.profiles.tutorial_done is 'True after the person finishes the last Tutorial step.';
