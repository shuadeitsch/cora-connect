-- 1.8.27: Cora admins may hard-delete feedback rows.
drop policy if exists feedback_delete on public.feedback;
create policy feedback_delete on public.feedback
  for delete to authenticated
  using (public.is_admin());

grant delete on public.feedback to authenticated;
