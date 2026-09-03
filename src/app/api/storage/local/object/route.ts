import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { getStorage, isSafeObjectKey } from "@/lib/storage";
import { verifyLocalUrl } from "@/lib/storage/signed-url";

export const dynamic = "force-dynamic";

/** Serves presigned downloads for the local/in-memory storage providers (development and tests only). */
export async function GET(request: NextRequest) {
  const env = getEnv();
  if (env.providers.storage !== "local" && env.providers.storage !== "memory") return NextResponse.json({ error: "Not available" }, { status: 404 });
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const exp = Number(request.nextUrl.searchParams.get("exp"));
  const sig = request.nextUrl.searchParams.get("sig") ?? "";
  if (!isSafeObjectKey(key) || !verifyLocalUrl("download", key, exp, sig)) return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
  const obj = await getStorage().getObject(key);
  if (!obj) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const filename = request.nextUrl.searchParams.get("filename");
  return new NextResponse(new Uint8Array(obj.body), {
    headers: {
      "Content-Type": obj.contentType ?? "application/octet-stream",
      "Content-Length": String(obj.body.length),
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
      ...(filename ? { "Content-Disposition": `inline; filename="${filename.replace(/[^\w.-]/g, "_")}"` } : {}),
    },
  });
}
