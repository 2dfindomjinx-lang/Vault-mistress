-- Apply before deploying the webhook. Re-runnable; no balances or installment
-- statuses are changed. Court also needs its updated court-wheels-pm.sql so
-- attributed TD payments appear with their owner's public profile.
begin;

create or replace function public.attribute_throne_debt_payment(p_event_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  e public.throne_webhook_events%rowtype;
  codes text[];
  matched_user uuid;
  cents numeric;
begin
  select * into e from public.throne_webhook_events
    where event_id = p_event_id for update;
  if not found then return jsonb_build_object('error', 'event_not_found'); end if;
  if e.status = 'credited' and e.attribution_code like 'TD-%' and e.user_id is not null then
    return jsonb_build_object('duplicate', true, 'userId', e.user_id, 'code', e.attribution_code);
  end if;
  if e.status not in ('received', 'failed', 'unmatched') or e.user_id is not null then
    return jsonb_build_object('error', 'event_already_handled');
  end if;

  -- Only the server's verified stored payload is authoritative. Never accept
  -- a caller-supplied user, amount, or code for historical repairs.
  if coalesce(e.payload ->> 'contract_version', '') <> '1'
    or coalesce(e.payload ->> 'event_type', '') not in
      ('gift_purchased', 'contribution_purchased', 'gift_crowdfunded')
    or upper(coalesce(e.payload -> 'data' ->> 'currency', '')) <> 'USD'
    or coalesce(e.payload -> 'data' ->> 'amount', e.payload -> 'data' ->> 'price', '') !~ '^[0-9]+$'
  then return jsonb_build_object('error', 'invalid_payment'); end if;
  cents := coalesce(e.payload -> 'data' ->> 'amount', e.payload -> 'data' ->> 'price')::numeric;
  if cents <= 0 then return jsonb_build_object('error', 'invalid_payment'); end if;

  select array_agg(distinct m[1]) into codes
  from regexp_matches(upper(coalesce(e.payload -> 'data' ->> 'message', '')),
    '\m((?:VM|PT|CK|WL|TD|P2)-[A-Z0-9]{4,8})\M', 'g') m;
  if coalesce(cardinality(codes), 0) <> 1 or codes[1] not like 'TD-%' then
    return jsonb_build_object('error', 'ambiguous_or_missing_debt_code');
  end if;

  -- Completed/paused contracts still identify their owner. Matching is not
  -- approval of an installment, nor does it reopen or settle a contract.
  select d.user_id into matched_user
  from public.throne_debts d join public.profiles p on p.id = d.user_id
  where upper(d.debt_code) = codes[1];
  if not found then return jsonb_build_object('error', 'unknown_debt_code'); end if;
  if (select count(*) from public.throne_debts where upper(debt_code) = codes[1]) <> 1 then
    return jsonb_build_object('error', 'ambiguous_debt_owner');
  end if;

  -- Do not reinterpret a payment that a manual credit already put in the
  -- money ledger, including a claim interrupted before event finalization.
  if exists (select 1 from public.money_transactions where source_key = 'throne:' || e.event_id)
    or exists (select 1 from public.tribute_claims where event_id = e.event_id and status <> 'unmatched')
  then return jsonb_build_object('error', 'payment_already_claimed'); end if;

  update public.throne_webhook_events
    set user_id = matched_user, attribution_code = codes[1], status = 'credited', processed_at = now()
    where event_id = e.event_id;
  update public.tribute_claims
    set status = 'linked', user_id = matched_user
    where event_id = e.event_id and status = 'unmatched';
  return jsonb_build_object('userId', matched_user, 'code', codes[1], 'awarded', 0);
end;
$$;

revoke all on function public.attribute_throne_debt_payment(text) from public, anon, authenticated;
grant execute on function public.attribute_throne_debt_payment(text) to service_role;

commit;

-- Historical repair is explicit: run the companion repair SQL AFTER the
-- Court feed migration. Do not reset all unmatched events or replay payouts.
