import { NextResponse } from "next/server";
import { loadPublishedStopPages } from "@/lib/published-stop-pages";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid stop place ID." }, { status: 400 });
  }
  const supabase = await createClient();
  try {
    const points = await loadPublishedStopPages((from, to) => supabase
      .rpc("list_published_stop_points", { p_stop_place_id: id }, { count: "exact" })
      .order("point_number").order("id").range(from, to));
    return NextResponse.json(points);
  } catch {
    return NextResponse.json({ error: "Stop points could not be loaded." }, { status: 500 });
  }
}
