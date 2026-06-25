insert into public.devotion_events (
  user_id,
  amount,
  source,
  source_key,
  metadata
)
select
  tx.user_id,
  floor(tx.amount * 0.01)::integer as amount,
  'admin_give' as source,
  'admin-give:' || tx.id::text as source_key,
  jsonb_build_object(
    'backfill', true,
    'baseAmount', tx.amount,
    'command', coalesce(tx.metadata ->> 'command', 'give'),
    'transactionId', tx.id
  ) as metadata
from public.coin_transactions tx
where tx.reason = 'throne_tribute'
  and coalesce(tx.metadata ->> 'command', '') = 'give'
  and tx.amount >= 100
  and not exists (
    select 1
    from public.devotion_events event
    where event.source_key = 'admin-give:' || tx.id::text
  );
