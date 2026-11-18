import {
  feedbackManagerContext,
  managementUuid,
  FeedbackManagementError,
} from "@/lib/feedback-environments";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(request: Request) {
  try {
    const { client, runtime, access } = await feedbackManagerContext();
    if (!access.database)
      throw new FeedbackManagementError("Database access required.", 403);
    const params = new URL(request.url).searchParams;
    if (params.get("environment") !== runtime.environment_id)
      return Response.json(
        { error: "Explicit environment required." },
        { status: 403, headers },
      );
    const dataset = managementUuid(params.get("dataset"));
    const version = await client
      .from("feedback_stop_datasets")
      .select("id,label,content_hash,created_at")
      .eq("id", dataset)
      .single();
    if (version.error) throw new Error("Dataset not found.");
    const deadline = Date.now() + 40_000;
    let size = 0;
    const read = async (table: string) => {
      const result: Record<string, unknown>[] = [];
      let cursor: string | null = null;
      while (true) {
        if (request.signal.aborted || Date.now() > deadline)
          throw new Error("Dataset export timed out.");
        let query = client
          .from(table)
          .select("id,data")
          .eq("dataset_id", dataset)
          .order("id")
          .limit(500);
        if (cursor) query = query.gt("id", cursor);
        const { data, error } = await query;
        if (error) throw new Error("Dataset export failed.");
        if (!data?.length) break;
        for (const row of data) {
          size += Buffer.byteLength(JSON.stringify(row.data));
          if (size > 16 * 1024 * 1024 || result.length >= 100000)
            throw new Error("Dataset export limit exceeded.");
          result.push(row.data);
          cursor = row.id;
        }
      }
      return result;
    };
    const places = await read("feedback_dataset_places");
    const points = await read("feedback_dataset_points");
    const document = Buffer.from(
      JSON.stringify({
        format: "feedback-stop-dataset-v1",
        source_environment: runtime.environment_id,
        version: version.data,
        places,
        points,
      }),
    );
    const audit = await client.rpc("record_feedback_dataset_export", {
      p_environment: runtime.environment_id,
      p_dataset: dataset,
    });
    if (audit.error) throw new Error("Could not record dataset export.");
    let cursor = 0;
    return new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          if (cursor < document.length) {
            controller.enqueue(document.subarray(cursor, cursor + 65536));
            cursor += 65536;
          } else controller.close();
        },
      }),
      {
        headers: {
          ...headers,
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="stop-dataset-${dataset}.json"`,
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Dataset export failed.",
      },
      {
        status: error instanceof FeedbackManagementError ? error.status : 503,
        headers,
      },
    );
  }
}
