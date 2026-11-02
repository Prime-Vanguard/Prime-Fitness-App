revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_admin(uuid) from public, anon;
revoke execute on function public.manages_member(uuid, uuid) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.manages_member(uuid, uuid) to authenticated;