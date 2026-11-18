import { createHash } from "node:crypto";
import {
  feedbackManagerContext,
  managementUuid,
  FeedbackManagementError,
} from "@/lib/feedback-environments";
import { csvLine } from "@/lib/csv-export";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(request: Request) {
  let failure: (() => Promise<void>) | undefined;
  try {
    const { client, runtime } = await feedbackManagerContext();
    const params = new URL(request.url).searchParams;
    if (params.get("environment") !== runtime.environment_id)
      return Response.json(
        { error: "Explicit environment selection required." },
        { status: 403, headers },
      );
    const selected = params.get("campaign");
    const campaign = selected === "legacy" ? null : managementUuid(selected);
    const started = await client.rpc("begin_feedback_evaluation_export", {
      p_environment: runtime.environment_id,
      p_campaign: campaign,
    });
    if (started.error || !started.data)
      throw new Error("Cannot start evaluation export.");
    const receipt = started.data as { id: string; result_count: number };
    failure = async () => {
      await client.rpc("finish_feedback_evaluation_export", {
        p_environment: runtime.environment_id,
        p_export: receipt.id,
        p_success: false,
      });
    };
    const chunks: Uint8Array[] = [];
    const encoder = new TextEncoder();
    const hash = createHash("sha256");
    let size = 0;
    let rows = 0;
    let cursor: string | null = null;
    let columns: string[] | null = null;
    const append = (text: string) => {
      const chunk = encoder.encode(text);
      size += chunk.byteLength;
      if (size > 32 * 1024 * 1024) throw new Error("Export exceeds 32 MiB.");
      chunks.push(chunk);
      hash.update(chunk);
    };
    append("\uFEFF");
    const deadline = Date.now() + 40_000;
    while (true) {
      if (request.signal.aborted || Date.now() > deadline)
        throw new Error("Export interrupted or timed out.");
      let query = client
        .from("feedback_test_results")
        .select(
          "*,feedback_evaluation_exclusions(excluded,reason,updated_at,updated_by)",
        );
      query = campaign
        ? query.eq("campaign_id", campaign)
        : query.is("campaign_id", null);
      if (cursor) query = query.gt("feedback_id", cursor);
      const { data, error } = await query
        .order("feedback_id")
        .limit(500)
        .returns<Record<string, unknown>[]>();
      if (error) throw new Error("Evaluation export query failed.");
      if (!data?.length) break;
      for (const raw of data) {
        if (++rows > 100000)
          throw new Error("Evaluation export row limit exceeded.");
        const { feedback_evaluation_exclusions, ...snapshot } = raw;
        const value = Array.isArray(feedback_evaluation_exclusions)
          ? feedback_evaluation_exclusions[0]
          : feedback_evaluation_exclusions;
        const x = (value ?? {}) as Record<string, unknown>;
        const row: Record<string, unknown> = {
          ...snapshot,
          provenance: snapshot.campaign_id
            ? "campaign"
            : "historical_unassigned",
          evaluation_excluded: x.excluded === true,
          exclusion_reason: x.reason ?? "",
          exclusion_updated_at: x.updated_at ?? "",
          exclusion_updated_by: x.updated_by ?? "",
        };
        if (!columns) {
          columns = Object.keys(row);
          append(csvLine(columns));
        }
        append(csvLine(columns.map((c) => row[c])));
        cursor = String(raw.feedback_id);
      }
    }
    if (!columns)
      append(
        csvLine([
          "feedback_id",
          "environment_id",
          "campaign_id",
          "dataset_version_id",
          "form_version_id",
          "provenance",
          "evaluation_excluded",
          "exclusion_reason",
        ]),
      );
    if (request.signal.aborted || Date.now() > deadline)
      throw new Error("Export interrupted or timed out.");
    const sha256 = hash.digest("hex");
    const finished = await client.rpc("finish_feedback_evaluation_export", {
      p_environment: runtime.environment_id,
      p_export: receipt.id,
      p_success: true,
      p_sha256: sha256,
      p_rows: rows,
    });
    if (finished.error || finished.data !== true)
      throw new Error("Evaluation changed during export. Please retry.");
    failure = undefined;
    let i = 0;
    return new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          if (i < chunks.length) controller.enqueue(chunks[i++]);
          else {
            chunks.length = 0;
            controller.close();
          }
        },
        cancel() {
          chunks.length = 0;
        },
      }),
      {
        headers: {
          ...headers,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="evaluation-${campaign ?? "historical"}-${receipt.id}.csv"`,
          "X-Evaluation-Export": receipt.id,
          "X-Content-SHA256": sha256,
        },
      },
    );
  } catch (error) {
    try {
      await failure?.();
    } catch {
      /* An unconfirmed pending receipt also blocks cleanup. */
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Evaluation export failed.",
      },
      {
        status: error instanceof FeedbackManagementError ? error.status : 503,
        headers,
      },
    );
  }
}
