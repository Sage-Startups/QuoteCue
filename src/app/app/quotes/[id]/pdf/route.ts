import { NextResponse, type NextRequest } from "next/server";
import { getWorkspaceContext } from "@/lib/auth";
import { assertFeature } from "@/lib/billing/entitlements";
import { generateQuotePdf } from "@/lib/services/quote-delivery";
import { AppError, toUserMessage } from "@/lib/utils/result";

export const dynamic = "force-dynamic";

/** Authenticated PDF download for workspace members. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertFeature(ctx.workspace.id, "PDF_DOWNLOAD");
    const force = request.nextUrl.searchParams.get("fresh") === "1";
    const pdf = await generateQuotePdf(ctx.workspace.id, id, ctx.supportSession ? null : ctx.user.id, { force });
    return new NextResponse(new Uint8Array(pdf.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.buffer.length),
        "Content-Disposition": `${request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${pdf.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: toUserMessage(error) }, { status: error instanceof AppError ? error.status : 500 });
  }
}
