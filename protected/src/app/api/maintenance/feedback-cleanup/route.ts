import { timingSafeEqual } from "node:crypto";
import { createAuthAdminClient } from "@/lib/supabase/admin";
import { getFeedbackEnvironmentHeaders } from "@/lib/supabase/config";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
/** Scheduling a job requires the owner. This endpoint only executes due jobs. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (
    !secret ||
    secret.length < 32 ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return Response.json({ error: "Unauthorized." }, { status: 401, headers });
  const binding = getFeedbackEnvironmentHeaders();
  const environment = binding["x-feedback-environment"];
  if (!environment)
    return Response.json(
      { error: "No fixed environment configured." },
      { status: 503, headers },
    );
  let client: ReturnType<typeof createAuthAdminClient>;
  try {
    client = createAuthAdminClient();
  } catch {
    return Response.json(
      { error: "Cleanup worker is not configured." },
      { status: 503, headers },
    );
  }
  const deadline = Date.now() + 40_000;
  let job: {
    id: string;
    lease_token: string;
    blocked?: boolean;
    waiting?: boolean;
  } | null = null;
  let completed = 0,
    blocked = 0,
    waiting = 0;
  try {
    for (let attempt = 0; attempt < 5 && Date.now() < deadline; attempt++) {
      const claimed = await client.rpc("claim_feedback_cleanup", {
        p_environment: environment,
      });
      if (claimed.error) throw new Error("Cannot claim cleanup.");
      job = claimed.data;
      if (!job) break;
      if (job.blocked) {
        blocked++;
        job = null;
        continue;
      }
      if (job.waiting) {
        waiting++;
        job = null;
        continue;
      }
      const args = {
        p_environment: environment,
        p_job: job.id,
        p_token: job.lease_token,
      };
      let drained = false;
      for (let batch = 0; batch < 100 && Date.now() < deadline; batch++) {
        const photos = await client.rpc("list_feedback_cleanup_photos", args);
        if (photos.error) throw new Error("Photo listing failed.");
        const paths = (photos.data as { name: string }[]).map((p) => p.name);
        if (!paths.length) {
          drained = true;
          break;
        }
        const removed = await client.storage
          .from("feedback-photos")
          .remove(paths);
        if (removed.error) throw new Error("Photo removal failed.");
      }
      if (!drained) {
        job = null;
        break;
      } // Lease expiry resumes a large cleanup safely.
      const finished = await client.rpc("complete_feedback_cleanup", args);
      if (finished.error) throw new Error("Cleanup finalization failed.");
      completed++;
      job = null;
    }
    return Response.json({ completed, blocked, waiting }, { headers });
  } catch {
    if (job)
      await client.rpc("fail_feedback_cleanup", {
        p_environment: environment,
        p_job: job.id,
        p_token: job.lease_token,
      });
    return Response.json(
      { error: "Cleanup failed. Evaluation results were preserved." },
      { status: 503, headers },
    );
  }
}
