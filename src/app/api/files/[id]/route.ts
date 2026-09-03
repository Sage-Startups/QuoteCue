import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext, getWorkspaceContext } from "@/lib/auth";
import { readStoredObject } from "@/lib/services/uploads";

export const dynamic = "force-dynamic";

/**
 * Authenticated proxy for private files. Workspace files require workspace
 * membership (or an active support session); site assets are public.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const object = await prisma.storedObject.findFirst({ where: { id, deletedAt: null }, select: { id: true, workspaceId: true, purpose: true, mimeType: true, originalFilename: true, sizeBytes: true } });
  if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (object.purpose !== "SITE_ASSET") {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
    if (object.workspaceId) {
      const ws = await getWorkspaceContext();
      const isMember = ws?.workspace.id === object.workspaceId;
      const isSuper = session.user.platformRole === "SUPER_ADMIN" && object.purpose === "LOGO";
      if (!isMember && !isSuper) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else {
      // Unclaimed uploads (e.g. logo during onboarding) are only visible to the uploader.
      const upload = await prisma.upload.findFirst({ where: { storedObjectId: object.id }, select: { userId: true } });
      if (upload?.userId !== session.user.id && session.user.platformRole !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  const file = await readStoredObject(object.id);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.body.length),
      "Cache-Control": object.purpose === "SITE_ASSET" ? "public, max-age=3600" : "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${(file.filename ?? "file").replace(/[^\w.-]/g, "_")}"`,
    },
  });
}
