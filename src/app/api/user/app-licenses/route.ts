import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { profileSelect } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

// Her Android programs, sold for Principessa Money on both sites.
//
// This is the same purchase the Court runs: one shared licence table, one
// shared RPC, so buying here and buying there are the same act. The
// one-licence-per-account rule is a partial unique index on
// (app_key, owner_user_id), which means it holds ACROSS the two sites for free
// - somebody cannot buy the wallpaper app here and again in the Court.
//
// The catalogue lives in court_links because that is where the price and the
// app key already are, and duplicating them here would only create something
// to drift. Principessa Lock is absent from it on purpose: that one needs her
// approval rather than a code, so it is not sold by either site.

type ProgramRow = {
  slug: string;
  title: string;
  description: string;
  link: string;
  price_pm: number | null;
  app_key: string | null;
};

type LicenseRow = {
  app_key: string;
  activation_code: string;
  bound_at: string | null;
  owner_name: string | null;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function requireUser() {
  const authSupabase = await createSupabaseServerClient();
  const { data, error } = await authSupabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

// Supabase's session cookies are SameSite=Lax, so a cross-site POST arrives
// without them and fails the auth check above already. This is the cheap
// second lock: a purchase spends real balance, and it should not be possible
// to make somebody's browser spend it from another page.
function blockCrossOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return jsonError("Cross-origin request refused.", 403);
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("host");
    try {
      if (!host || new URL(origin).host !== host) {
        return jsonError("Cross-origin request refused.", 403);
      }
    } catch {
      return jsonError("Cross-origin request refused.", 403);
    }
  }

  return null;
}

async function readCatalogue(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await supabase
    .from("court_links")
    .select("slug, title, description, link, price_pm, app_key")
    .eq("activation", "code")
    .eq("active", true)
    .not("app_key", "is", null)
    .gte("price_pm", 1)
    .order("price_pm", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProgramRow[];
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const userId = await requireUser();
  if (!userId) return jsonError("Authentication required.", 401);

  const supabase = createSupabaseAdminClient();

  // A catalogue that cannot be read means the shelf simply is not there, not
  // that the Money Shop is broken: court-programs.sql adds the columns this
  // query needs, so before it has been run this is an expected miss rather
  // than a fault worth showing on a shop page. The log still carries it.
  let catalogue: ProgramRow[];
  try {
    catalogue = await readCatalogue(supabase);
  } catch (error) {
    console.error("[app-licenses] catalogue read failed", error);
    return Response.json({ programs: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const { data: licenceData, error: licenceError } = await supabase
      .from("app_activation_codes")
      .select("app_key, activation_code, bound_at, owner_name")
      .eq("owner_user_id", userId);

    if (licenceError) throw licenceError;

    const owned = new Map<string, LicenseRow>();
    for (const row of (licenceData ?? []) as LicenseRow[]) owned.set(row.app_key, row);

    return Response.json(
      {
        programs: catalogue.map((row) => {
          const licence = row.app_key ? owned.get(row.app_key) : undefined;
          return {
            slug: row.slug,
            title: row.title,
            description: row.description,
            link: row.link,
            pricePm: Number(row.price_pm) || 0,
            code: licence?.activation_code ?? null,
            bound: Boolean(licence?.bound_at),
            deviceName: licence?.owner_name ?? null,
          };
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[app-licenses] licence read failed", error);
    return jsonError("Could not load her programs.", 500);
  }
}

export async function POST(request: Request) {
  const crossOrigin = blockCrossOrigin(request);
  if (crossOrigin) return crossOrigin;

  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const userId = await requireUser();
  if (!userId) return jsonError("Authentication required.", 401);

  const body = (await request.json().catch(() => null)) as { slug?: string } | null;
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  if (!slug || slug.length > 64) return jsonError("That program is not sold here.", 404);

  const supabase = createSupabaseAdminClient();
  const limit = await checkRateLimit(supabase, `app-licenses:${userId}`, 10, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  try {
    // Everything that decides the outcome happens inside this one call: the
    // price lookup, the balance lock, the code, the ledger row. The request
    // only names a slug, so there is no price or quantity here to tamper with.
    const { data, error } = await supabase.rpc("purchase_app_license_with_pm", {
      p_user_id: userId,
      p_slug: slug,
    });
    if (error) throw error;

    const result = (data ?? {}) as {
      error?: string;
      code?: string;
      alreadyOwned?: boolean;
      money?: number;
      price?: number;
      spent?: number;
    };

    if (result.error === "insufficient_money") {
      return jsonError(
        `This costs ${(result.price ?? 0).toLocaleString()} Principessa Money. You have ${(result.money ?? 0).toLocaleString()}.`,
        402,
      );
    }
    if (result.error === "not_purchasable") return jsonError("That program is not sold here.", 404);
    if (result.error === "profile_not_found") return jsonError("Profile not found.", 404);
    if (result.error || !result.code) return jsonError("That did not go through.", 400);

    // The panel re-renders the whole profile strip from this, exactly like the
    // Money Shop does after a purchase.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(profileSelect)
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return jsonError(profileError?.message ?? "Profile not found.", 404);
    }

    return Response.json({
      alreadyOwned: Boolean(result.alreadyOwned),
      code: result.code,
      profile,
      slug,
      spent: Number(result.spent ?? 0),
    });
  } catch (error) {
    console.error("[app-licenses] purchase failed", error);
    return jsonError("That did not go through.", 500);
  }
}
