alter table public.app_activation_codes
  add column if not exists favorite_kink text;

alter table public.app_activation_codes
  drop constraint if exists app_activation_codes_favorite_kink_check;

alter table public.app_activation_codes
  add constraint app_activation_codes_favorite_kink_check
  check (
    favorite_kink is null
    or favorite_kink in ('BNWO', 'Censored', 'Femdom', 'All')
  );
