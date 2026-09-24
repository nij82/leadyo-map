-- Supabase grants EXECUTE on new functions directly to anon by default.
-- The initial PUBLIC revocation did not remove that separate grant.
revoke execute on function public.admin_members() from anon;
revoke execute on function public.member_status() from anon;
revoke execute on function public.moderate_listing(uuid,text,text) from anon;
revoke execute on function public.set_member_status(uuid,text,text) from anon;
