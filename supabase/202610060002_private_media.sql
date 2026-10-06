-- Optional storage extraction, apply before npm run media:upload.
-- Authenticated routes remain the ONLY viewer entry point. No browser policies.
begin;
insert into storage.buckets(id,name,public) values('vault-private-media','vault-private-media',false)
  on conflict(id) do update set public=false;
-- Restrictive rules also override any broad permissive policies already present.
drop policy if exists "Vault private media server only" on storage.objects;
create policy "Vault private media server only" on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'vault-private-media') with check (bucket_id <> 'vault-private-media');
commit;
