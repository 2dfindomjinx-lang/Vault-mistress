-- Shared Court / Vault database. Run once from either repository.
-- Only Lock's displayed lifetime access price changes; PM products are untouched.
begin;
update public.court_links
set price = '$20', updated_at = now()
where slug = 'lock' and price is distinct from '$20';
commit;
