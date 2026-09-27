import { handleLockTransfers } from "@/lib/lock-admin-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = handleLockTransfers;
export const POST = handleLockTransfers;
