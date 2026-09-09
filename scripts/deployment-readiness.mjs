// Read-only schema probe; never credits balances or consumes rate-limit buckets.
import "./_env.mjs";
import { createClient } from "@supabase/supabase-js";
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
)
  throw Error(
    "Deployment environment credentials are not configured. No remote check was performed.",
  );
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const { data, error } = await db.rpc("check_economy_readiness");
if (error || !data || Object.values(data).some((value) => value !== true))
  throw Error(
    "Required database migration or rate limiter is missing. Apply the documented migrations before deploying.",
  );
console.log("Required economy, metrics and rate-limit functions are present.");
