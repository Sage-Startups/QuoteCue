import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionContext, getWorkspaceContext } from "@/lib/auth";
import { finalizeUpload, signedDownloadUrl } from "@/lib/services/uploads";
import { attachQuoteMedia } from "@/lib/services/quotes";
import { toUserMessage, AppError } from "@/lib/utils/result";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  uploadId: z.string().uuid(),
  quoteId: z.string().uuid().optional(),
  attachAs: z.enum(["IMAGE", "AUDIO", "DOCUMENT"]).optional(),
});

/** Final step of the upload flow: verifies the object and marks the upload complete. */
export async function POST(request: NextRequest) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const ws = await getWorkspaceContext();
    if (ws?.supportSession) return NextResponse.json({ error: "Support mode is read-only" }, { status: 403 });
    const upload = await (async () => {
      try {
        return await finalizeUpload({ uploadId: parsed.data.uploadId, workspaceId: ws?.workspace.id ?? null, userId: session.user.id });
      } catch (error) {
        // Logo uploads created before the workspace existed carry a null workspaceId.
        if (ws && error instanceof AppError && error.status === 404) {
          return finalizeUpload({ uploadId: parsed.data.uploadId, workspaceId: null, userId: session.user.id });
        }
        throw error;
      }
    })();
    let media: { id: string } | null = null;
    if (parsed.data.quoteId && parsed.data.attachAs && ws) {
      media = await attachQuoteMedia(ws.workspace.id, parsed.data.quoteId, upload.storedObject.id, parsed.data.attachAs);
    }
    const previewUrl = upload.storedObject.mimeType.startsWith("image/") ? await signedDownloadUrl(upload.storedObject.id) : null;
    return NextResponse.json({
      storedObjectId: upload.storedObject.id,
      mediaId: media?.id ?? null,
      mimeType: upload.storedObject.mimeType,
      sizeBytes: upload.storedObject.sizeBytes,
      width: upload.storedObject.width,
      height: upload.storedObject.height,
      previewUrl,
    });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: toUserMessage(error) }, { status });
  }
}
