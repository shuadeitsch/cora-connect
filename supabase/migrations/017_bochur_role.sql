-- 1.8.0 step 1 of 2: add the 'bochur' role. Must be committed before 018 runs.
-- Adds one enum value only. No data changes.
alter type public.user_role add value if not exists 'bochur';
