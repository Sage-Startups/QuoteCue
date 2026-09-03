import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { getStorage, isSafeObjectKey } from "@/lib/storage";
import { verifyLocalUrl } from "@/lib/storage/signed-url";

export const dynamic = "force-dynamic";

/** Receives presigned PUT uploads for the local/in-memory storage providers (development and tests only). */
export async function PUT(request: NextRequest) {
  const env = getEnv();
  if (env.providers.storage !== "local" && env.providers.storage !== "memory") return NextResponse.json({ error: "Not available" }, { status: 404 });
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const exp = Number(request.nextUrl.searchParams.get("exp"));
  const sig = request.nextUrl.searchParams.get("sig") ?? "";
  const ct = request.nextUrl.searchParams.get("ct") ?? "";
  if (!isSafeObjectKey(key) || !verifyLocalUrl("upload", key, exp, sig, ct)) return NextResponse.json({ error: "Invalid or expired upload URL" }, { status: 403 });
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length === 0) return NextResponse.json({ error: "Empty body" }, { status: 400 });
  await getStorage().putObject(key, body, ct || request.headers.get("content-type") || "application/octet-stream");
  return new NextResponse(null, { status: 200 });
}
