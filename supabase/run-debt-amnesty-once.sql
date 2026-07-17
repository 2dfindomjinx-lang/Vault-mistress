-- Run debt-capacity-admin-control.sql first.
-- Then run this file once in Supabase SQL Editor.
-- A database-level guard rejects every later attempt.

begin;

select public.admin_forgive_all_debts(
  null::uuid,
  '2026 debt amnesty - closed without refund or penalty'
);

commit;
