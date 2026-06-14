export const userDebtContractSelect =
  "id, user_id, pet_name, contract_type, period_type, debt_amount, duration_periods, paid_periods, missed_periods, random_generated, status, started_at, next_due_at, ends_at, declared_age, full_name, custom_note, timezone, consent_primary, consent_secondary, image_urls, created_at, updated_at";

export const adminDebtContractSelect =
  "id, user_id, contract_type, pet_name, full_name, declared_age, timezone, custom_note, debt_amount, duration_periods, period_type, paid_periods, missed_periods, status, consent_primary, consent_secondary, random_generated, started_at, next_due_at, ends_at, created_at, updated_at";
