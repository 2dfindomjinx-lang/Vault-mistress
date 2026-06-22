-- One-shot reset for existing daily normal task + daily pet task cooldowns.
-- Keeps weekly tax / debt contract rows intact.

update public.user_tasks
set
  claimed_at = null,
  completed_at = case
    when task_id in ('typing-accuracy', 'daily-login', 'wait-obediently', 'timeout-risk', 'vertical-motion', 'number-pick', 'case-opening')
      then null
    else completed_at
  end,
  metadata = case
    when task_id = 'typing-accuracy' then jsonb_build_object('attemptsRemaining', 3)
    when task_id = 'timeout-risk' then '{}'::jsonb
    when task_id in ('wait-obediently', 'vertical-motion', 'number-pick', 'case-opening') then '{}'::jsonb
    else metadata
  end
where task_id in (
  'daily-login',
  'typing-accuracy',
  'wait-obediently',
  'timeout-risk',
  'vertical-motion',
  'number-pick',
  'case-opening'
);

update public.user_pet_tasks
set
  completed_at = null,
  reviewed_at = null,
  status = 'available',
  metadata = '{}'::jsonb
where task_id in (
  'pet-voice-proof',
  'pet-photo-proof',
  'pet-throne-proof',
  'pet-perfect-writing',
  'pet-confession-writing',
  'pet-evil-wait',
  'pet-false-hope',
  'pet-favor-roulette'
);
