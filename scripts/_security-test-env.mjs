// Integration tests must never inherit the application's production .env.local.
const required = [
  "SECURITY_TEST_SUPABASE_URL",
  "SECURITY_TEST_SERVICE_ROLE_KEY",
  "SECURITY_TEST_ANON_KEY",
];
if (
  process.env.ALLOW_TEST_DB_WRITES !== "yes" ||
  required.some((k) => !process.env[k])
)
  throw Error(
    "Integration tests require ALLOW_TEST_DB_WRITES=yes and explicit SECURITY_TEST_* credentials for a disposable database. No application .env file is loaded.",
  );
const target = new URL(process.env.SECURITY_TEST_SUPABASE_URL);
if (!["http:", "https:"].includes(target.protocol))
  throw Error("Invalid test database URL.");
if (target.origin === process.env.NEXT_PUBLIC_SUPABASE_URL)
  throw Error("Test database must differ from the application database.");
if (process.env.SECURITY_TEST_CONFIRM_HOST !== target.host)
  throw Error(
    "Set SECURITY_TEST_CONFIRM_HOST to the disposable database host.",
  );
if (
  process.env.TEST_BASE_URL &&
  !["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(process.env.TEST_BASE_URL).hostname,
  )
)
  throw Error("HTTP integration checks require a locally running test server.");
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SECURITY_TEST_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SECURITY_TEST_SERVICE_ROLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.SECURITY_TEST_ANON_KEY;
