import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return NextResponse.json({
      error: error?.message ?? null,
      user: null,
    });
  }

  return NextResponse.json({ user: data.user });
}
