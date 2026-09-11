-- Run after 202609110001_throne_attribution.sql and the Court's updated
-- court-wheels-pm.sql. Only verified unmatched TD payments are considered.
-- Each result explains whether attribution succeeded or requires review.
-- Re-running is safe: finalized events are excluded and the RPC locks and
-- rechecks every event. No PM, coins, devotion, or installments are changed.
begin;
select e.event_id, public.attribute_throne_debt_payment(e.event_id) as result
from public.throne_webhook_events e
where e.status = 'unmatched'
  and e.user_id is null
  and coalesce(e.payload -> 'data' ->> 'message', '') ~* '\mTD-[A-Z0-9]{4,8}\M'
order by e.created_at;
commit;
