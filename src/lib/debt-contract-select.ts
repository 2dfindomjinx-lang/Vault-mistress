export const userDebtContractSelect =
  "id, user_id, pet_name, contract_type, period_type, debt_amount, current_installment_remaining, duration_periods, paid_periods, missed_periods, random_generated, status, started_at, next_due_at, ends_at, declared_age, full_name, custom_note, timezone, consent_primary, consent_secondary, purchase_pledge, capacity_snapshot, admin_review_required, overdue_since, closed_at, close_reason, image_urls, created_at, updated_at";

export const adminDebtContractSelect =
  "id, user_id, contract_type, pet_name, full_name, declared_age, timezone, custom_note, debt_amount, current_installment_remaining, duration_periods, period_type, paid_periods, missed_periods, status, consent_primary, consent_secondary, purchase_pledge, capacity_snapshot, admin_review_required, overdue_since, closed_at, close_reason, closed_by_admin_id, random_generated, started_at, next_due_at, ends_at, created_at, updated_at";
