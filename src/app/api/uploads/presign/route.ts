import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionContext, getWorkspaceContext } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createPresignedUpload } from "@/lib/services/uploads";
import { toUserMessage, AppError } from "@/lib/utils/result";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  purpose: z.enum(["LOGO", "QUOTE_IMAGE", "QUOTE_AUDIO", "QUOTE_DOCUMENT", "SITE_ASSET"]),
  filename: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
  quoteId: z.string().uuid().optional(),
});

/** Step 1 of the upload flow: authenticated users request a short-lived presigned upload URL. */
export async function POST(request: NextRequest) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  try {
    await enforceRateLimit("presign", session.user.id);
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
    const input = parsed.data;
    let workspaceId: string | null = null;
    if (input.purpose === "SITE_ASSET") {
      if (session.user.platformRole !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else if (input.purpose === "LOGO") {
      const ws = await getWorkspaceContext();
      if (ws?.supportSession) return NextResponse.json({ error: "Support mode is read-only" }, { status: 403 });
      workspaceId = ws?.workspace.id ?? null; // null during onboarding; claimed by the workspace once created
    } else {
      const ws = await getWorkspaceContext();
      if (!ws) return NextResponse.json({ error: "No workspace" }, { status: 403 });
      if (ws.supportSession) return NextResponse.json({ error: "Support mode is read-only" }, { status: 403 });
      workspaceId = ws.workspace.id;
    }
    const result = await createPresignedUpload({ workspaceId, userId: session.user.id, purpose: input.purpose, filename: input.filename, mimeType: input.mimeType, sizeBytes: input.sizeBytes, quoteId: input.quoteId ?? null });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: toUserMessage(error) }, { status });
  }
}
