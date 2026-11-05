-- Each person's chosen color theme (Settings > Account > Theme). Null = Classic green.
alter table public.profiles add column if not exists theme text;
alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles add constraint profiles_theme_check check (theme is null or theme in ('classic','ocean','sand','purple','soft','dark'));
