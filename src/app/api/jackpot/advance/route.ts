import { requireAdmin } from "@/lib/admin-guard";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import {
  ensureCurrentJackpot,
  getCurrentJackpot,
  getContributionTotal,
  maybeSelectWinner,
  buildJackpotState,
} from "@/app/api/jackpot/route";
import { JACKPOT_BASE_POOL } from "@/lib/jackpot";

type AdminContext = Awaited<ReturnType<typeof requireAdmin>>;

// Cron or a verified trusted-admin session only - this drives winner
// selection/payout, so any regular authenticated user accepted here would
// let a non-admin trigger an admin/cron-only economic operation.
async function authorizeAdvance(request: Request): Promise<AdminContext> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

  if (cronSecret && token === cronSecret) {
    if (!isSupabaseAdminConfigured) {
      return {
        error: `Admin Supabase environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`,
        status: 500,
      } as const;
    }

    return {
      adminProfile: null,
      adminUser: { id: "cron" },
      supabase: createSupabaseAdminClient(),
    } as unknown as AdminContext;
  }

  return requireAdmin();
}

export async function POST(request: Request) {
  const admin = await authorizeAdvance(request);

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const supabase = admin.supabase;

  try {
    // Ensure the row for the CURRENT time-based cycle exists (creates on first hit or after rollover).
    // This is the main recovery: if no row for new cycleKey, previous "preparing + checking vault" ends.
    const { cycle, jackpot: ensured } = await ensureCurrentJackpot(supabase);

    // Re-fetch fresh for safety after ensure
    const { jackpot } = await getCurrentJackpot(supabase);

    const activeJackpot = jackpot ?? ensured;

    if (!activeJackpot) {
      return Response.json({ error: "Failed to ensure current jackpot row" }, { status: 500 });
    }

    // Determine if we should attempt winner selection.
    // Mirror the phase logic from buildJackpotState but using server time.
    const nowMs = Date.now();
    const contribEndsMs = new Date(activeJackpot.contribution_ends_at).getTime();
    const rawPhase = nowMs < contribEndsMs ? "contribution" : "winner";
    const alreadyDecided = Boolean(activeJackpot.winner_selected_at || activeJackpot.skipped_at);
    const phase = rawPhase === "winner" && alreadyDecided ? "preparing" : rawPhase;

    let selectedOrSkipped = false;
    let afterJackpot = activeJackpot;

    if (rawPhase === "winner" && !alreadyDecided) {
      try {
        // Compute a reasonable pool for winner_amount fallback if needed
        const contribTotal = await getContributionTotal(supabase, activeJackpot.id).catch(() => 0);
        const poolForSelect = Number(activeJackpot.base_pool ?? JACKPOT_BASE_POOL) + Number(contribTotal ?? 0);
        afterJackpot = await maybeSelectWinner(supabase, activeJackpot, "winner", poolForSelect);
        selectedOrSkipped = Boolean(afterJackpot.winner_selected_at || afterJackpot.skipped_at);
      } catch (selErr) {
        console.error("Advance: maybeSelectWinner threw after internal recovery", selErr);
        // Recovery inside maybe will have attempted skip; continue so cycle is not stuck.
      }
    }

    // Optional: build full state for response (uses read client but we have admin ok)
    let state = null;
    try {
      // buildJackpotState accepts read client; admin works.
      state = await buildJackpotState(supabase, afterJackpot, null);
    } catch (stateErr) {
      console.error("Advance: build state after ensure/select failed (non-fatal)", stateErr);
    }

    return Response.json({
      ok: true,
      cycleKey: cycle.cycleKey,
      phase: state?.phase ?? phase,
      jackpotId: afterJackpot.id,
      winnerSelected: Boolean(afterJackpot.winner_selected_at),
      skipped: Boolean(afterJackpot.skipped_at),
      selectedOrSkipped,
      endsAt: afterJackpot.ends_at,
      state,
    });
  } catch (error) {
    console.error("Jackpot advance failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Jackpot advance failed" },
      { status: 500 },
    );
  }
}
