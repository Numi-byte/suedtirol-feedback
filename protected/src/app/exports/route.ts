import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPortalAccess } from "@/lib/portal-access";
import { stopSearchFilter } from "@/lib/portal-pagination";
import { csvLine, flattenExport } from "@/lib/csv-export";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const parent =
  "bus_stops(name_de,name_it,name_en,municipality_de,municipality_it)";
export async function GET(request: Request) {
  const headers = {
    "Cache-Control": "private, no-store",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const url = new URL(request.url),
      table = url.searchParams.get("table");
    if (!table || !["places", "points", "feedback"].includes(table))
      return NextResponse.json(
        { error: "Invalid export." },
        { status: 400, headers },
      );
    const client = await createClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user)
      return NextResponse.json(
        { error: "Sign in required." },
        { status: 401, headers },
      );
    const access = await getPortalAccess(client);
    if (!(table === "feedback" ? access.feedback : access.database))
      return NextResponse.json(
        { error: "Section access required." },
        { status: 403, headers },
      );
    const place = url.searchParams.get("place");
    if (
      place &&
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        place,
      )
    )
      return NextResponse.json(
        { error: "Invalid stop place." },
        { status: 400, headers },
      );
    const scope = url.searchParams.get("scope") ?? "all";
    if (!["all", "active", "archived"].includes(scope))
      return NextResponse.json(
        { error: "Invalid scope." },
        { status: 400, headers },
      );
    const filter = stopSearchFilter(url.searchParams.get("q") ?? "");
    const reply = url.searchParams.get("replies") ?? "all";
    if (!["all", "replied", "unreplied"].includes(reply))
      return NextResponse.json(
        { error: "Invalid reply selection." },
        { status: 400, headers },
      );
    const chunks: Uint8Array[] = [];
    const encoder = new TextEncoder();
    let bytes = 0,
      rows = 0;
    let columns: string[] | null = null;
    let cursor: string | null = null;
    const append = (text: string) => {
      const chunk = encoder.encode(text);
      bytes += chunk.length;
      if (bytes > 32 * 1024 * 1024) throw Error("limit");
      chunks.push(chunk);
    };
    append("\uFEFF");
    const deadline = Date.now() + 45000;
    // Fetch beyond PostgREST's row cap, with stable ordering and bounded memory.
    while (true) {
      if (request.signal.aborted) throw Error("aborted");
      if (Date.now() > deadline) throw Error("limit");
      let query =
        table === "places"
          ? client.from("bus_stops").select("*")
          : table === "points"
            ? client.from("stop_points").select("*, " + parent)
            : client
                .from("stop_feedback")
                .select(
                  "*, " +
                    parent +
                    ",stop_points(point_number,name_de,name_it),stop_feedback_categories(category_slug,feedback_categories(label_de,label_it,label_en)),stop_feedback_photos(id),feedback_replies!left(*)",
                );
      if (table === "places") {
        if (scope === "active") query = query.is("archived_at", null);
        if (scope === "archived") query = query.not("archived_at", "is", null);
        if (filter) query = query.or(filter);
        if (url.searchParams.get("missing") === "1")
          query = query.eq("municipality_names_missing", true);
      }
      if (table === "points" && place) query = query.eq("stop_place_id", place);
      if (table === "feedback" && reply === "replied")
        query = query.not("feedback_replies", "is", null);
      if (table === "feedback" && reply === "unreplied")
        query = query.is("feedback_replies", null);
      if (cursor) query = query.gt("id", cursor);
      const result: { data: Record<string, unknown>[] | null; error: unknown } =
        await query.order("id").limit(500).returns<Record<string, unknown>[]>();
      const { data, error } = result;
      if (error) throw Error("query");
      if (Date.now() > deadline) throw Error("limit");
      if (!data?.length) break;
      for (const raw of data) {
        if (++rows > 100000) throw Error("limit");
        const row = flattenExport(raw, table);
        if (!columns) {
          columns = Object.keys(row);
          append(csvLine(columns));
        }
        append(csvLine(columns.map((key) => row[key])));
        cursor = String(raw.id);
      }
    }
    if (!columns)
      append(
        csvLine(
          table === "places"
            ? ["id", "name_de", "name_it", "name_en"]
            : table === "points"
              ? ["id", "stop_place_id", "name_de", "name_it", "point_number"]
              : [
                  "id",
                  "bus_stop_id",
                  "stop_point_id",
                  "description",
                  "status",
                  "reply_body",
                ],
        ),
      );
    // All rows are validated before offering a file, so query failures cannot
    // silently turn into a truncated CSV. Stream the prepared chunks on Vercel.
    let chunkIndex = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (chunkIndex < chunks.length)
          controller.enqueue(chunks[chunkIndex++]);
        else {
          chunks.length = 0;
          controller.close();
        }
      },
      cancel() {
        chunks.length = 0;
      },
    });
    return new Response(stream, {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${table}-${new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })}.csv"`,
      },
    });
  } catch (error) {
    const large = error instanceof Error && error.message === "limit";
    return NextResponse.json(
      {
        error: large
          ? "Export too large or timed out. Narrow the selection and retry."
          : "Export failed. Please retry.",
      },
      { status: large ? 413 : 503, headers },
    );
  }
}
