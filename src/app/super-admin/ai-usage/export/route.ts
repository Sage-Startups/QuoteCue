import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/utils/csv";
import { resolveDateRange } from "@/lib/utils/dates";
import { csvResponse, excludeDemoFrom, superAdminForRoute } from "../../_lib/admin";
import { aiRunWhere } from "../stats";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await superAdminForRoute();
  if (guard.response) return guard.response;
  const sp = request.nextUrl.searchParams;
  const range = resolveDateRange(sp.get("range") ?? undefined, sp.get("from"), sp.get("to"));
  const runs = await prisma.aiRun.findMany({
    where: aiRunWhere(range.from, range.to, excludeDemoFrom(sp.get("excludeDemo") ?? undefined)),
    orderBy: { startedAt: "desc" },
    take: 10000,
    select: { id: true, feature: true, status: true, provider: true, model: true, promptVersionNo: true, errorCategory: true, errorMessage: true, inputTokens: true, outputTokens: true, audioSeconds: true, estimatedCostMicros: true, creditConsumed: true, startedAt: true, completedAt: true, durationMs: true, workspaceId: true, userId: true, quoteId: true },
  });
  const rows = runs.map((r) => ({
    id: r.id,
    started_at: r.startedAt.toISOString(),
    completed_at: r.completedAt?.toISOString() ?? "",
    duration_ms: r.durationMs ?? "",
    feature: r.feature,
    status: r.status,
    provider: r.provider,
    model: r.model,
    prompt_version: r.promptVersionNo ?? "",
    error_category: r.errorCategory,
    error_message: r.errorMessage ?? "",
    input_tokens: r.inputTokens,
    output_tokens: r.outputTokens,
    audio_seconds: r.audioSeconds,
    estimated_cost_usd: (r.estimatedCostMicros / 1_000_000).toFixed(6),
    credit_consumed: r.creditConsumed ? "yes" : "no",
    workspace_id: r.workspaceId ?? "",
    user_id: r.userId ?? "",
    quote_id: r.quoteId ?? "",
  }));
  return csvResponse(toCsv(rows), "ai-runs");
}
