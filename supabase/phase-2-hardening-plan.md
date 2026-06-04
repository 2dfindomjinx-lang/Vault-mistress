# Phase 2 Full Hardening Plan

Do not apply full database blocking until these mutations have been moved from the browser client to backend API routes that use the service role and server-side validation.

## Move To Backend API Routes

- Profile economy mutations:
  - `profiles.coins`
  - `profiles.affection`
  - `profiles.tribute_total`
  - `profiles.shame_count`
  - `profiles.pet_score`
  - `profiles.owner_likeness`
- Task state and rewards:
  - `user_tasks.completed_at`
  - `user_tasks.claimed_at`
  - `user_tasks.reward_coins`
  - `user_tasks.metadata`
- Gallery unlocks:
  - `user_gallery`
  - `unlocked_gallery_items`
  - `user_pet_gallery`
- Purchases and unlocks that change user state:
  - cosmetics
  - titles
  - sacrifice unlocks
  - pet task rewards
  - debt contract payments

## Server Validation Required

- Validate authenticated user with server-side Supabase auth.
- Derive all reward values server-side from known task IDs and active event data.
- Do not accept `reward_coins`, `coins`, `affection`, `tribute_total`, `pet_score`, or `owner_likeness` from the request body as trusted values.
- Validate gallery item IDs against the server-side item catalog.
- Validate purchases against server-side item costs and ownership.
- Record coin transactions server-side in the same request that changes the balance.

## After Backend Migration

Add a database trigger that blocks non-privileged client updates to:

- `profiles.coins`
- `profiles.affection`
- `profiles.tribute_total`
- `profiles.shame_count`
- `profiles.pet_score`
- `profiles.owner_likeness`

Then add exact server-side task reward validation for every task route.
