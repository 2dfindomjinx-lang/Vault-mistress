-- Create a 4-week Evil Debt Contract for @gooner12378: 42,000 coins/week, weekly period.
-- Run once in the Supabase SQL editor. Sets status to 'active' immediately (skips pending_review).

insert into public.pet_debt_contracts (
  user_id,
  pet_name,
  contract_type,
  period_type,
  debt_amount,
  current_installment_remaining,
  duration_periods,
  paid_periods,
  missed_periods,
  random_generated,
  status,
  started_at,
  next_due_at,
  ends_at,
  declared_age,
  full_name,
  timezone,
  custom_note,
  consent_primary,
  consent_secondary,
  image_urls
)
select
  p.id,
  'Loser Pet',
  'evil',
  'weekly',
  42000,
  42000,
  4,
  0,
  0,
  false,
  'active',
  now(),
  now() + interval '7 days',
  now() + interval '28 days',
  null,
  null,
  null,
  '@ChloesRTsub',
  true,
  true,
  '[]'::jsonb
from public.profiles p
where lower(p.username) = lower('gooner12378');
