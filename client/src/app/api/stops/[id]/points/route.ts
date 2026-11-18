import { NextResponse } from "next/server";
import { loadPublishedStopPages } from "@/lib/published-stop-pages";
import { createPublicClient } from "@/lib/supabase/public";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid stop place ID." }, { status: 400 });
  }
  try {
    const supabase = createPublicClient();
    const points = await loadPublishedStopPages((from, to) => supabase
      .rpc("list_published_stop_points", { p_stop_place_id: id }, { count: "exact" })
      .order("point_number").order("id").range(from, to));
    return NextResponse.json(points, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ error: "Stop points could not be loaded." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "10" } });
  }
}
