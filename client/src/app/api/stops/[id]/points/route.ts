import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid stop place ID." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_published_stop_points", { p_stop_place_id: id });
  if (error) return NextResponse.json({ error: "Stop points could not be loaded." }, { status: 500 });
  return NextResponse.json(data ?? []);
}

