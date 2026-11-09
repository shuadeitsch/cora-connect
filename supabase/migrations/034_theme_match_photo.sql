-- 1.8.29: optional "Match colors to my photo" palette saved with the profile theme.
alter table public.profiles add column if not exists theme_match_photo boolean not null default false;
alter table public.profiles add column if not exists theme_colors jsonb;

comment on column public.profiles.theme_match_photo is 'When true, apply theme_colors derived from the background photo instead of the preset theme.';
comment on column public.profiles.theme_colors is 'Client-extracted palette (primary, accent, panel tint, overlay, dark) when theme_match_photo is on.';
