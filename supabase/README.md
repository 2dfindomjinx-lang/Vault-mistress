# Database changes

schema.sql is the reviewed, non-personal legacy schema snapshot. It is not a complete migration history and must not be replayed blindly on production.

New changes belong in migrations/ with sortable immutable names. Apply 202609090001_atomic_economy.sql before the corresponding API release. It is additive and safe to reapply. Existing balances are not changed by installation. Only service_role can execute the command or read its receipts/failure table.

Operational scripts at this directory's root stay ignored because some target real users. Do not copy those into migrations. Capture the deployed schema separately when database access is available; the local snapshot does not prove the production schema version.

Apply 202609090002_product_milestones.sql after the first migration for prospective product metrics. No historical milestones are fabricated; the first observed cohort includes returning users.

Run npm run test:security for isolated route and PostgreSQL checks. They never load .env.local. A production release also needs npm run check:deployment in its deployment environment and a backup/restore check. No production SQL has been applied by this implementation.
