import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadPublishedStopPages } from "@/lib/published-stop-pages";

export async function GET() {
  const supabase = await createClient();
  try {
    const stops = await loadPublishedStopPages((from, to) => supabase
      .rpc("list_published_stops_with_feedback_count", {}, { count: "exact" })
      .order("id").range(from, to));
    return NextResponse.json(stops, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load published stops." },
      { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
