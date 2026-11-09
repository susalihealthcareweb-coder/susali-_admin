import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { localSig, LOCAL_ROOT, cloudEnabled } from "@/lib/storage";

// Development-only stand-in for an S3 signed PUT.
export async function PUT(req) {
  if (cloudEnabled()) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const u = new URL(req.url);
  const key = u.searchParams.get("key") || "";
  const exp = Number(u.searchParams.get("exp"));
  const size = Number(u.searchParams.get("size"));
  const sig = u.searchParams.get("sig");
  if (!key || key.includes("..") || exp < Date.now() / 1000 || sig !== localSig(["put", key, exp, size])) {
    return NextResponse.json({ error: "Invalid or expired upload link" }, { status: 403 });
  }
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length !== size) return NextResponse.json({ error: "File size mismatch" }, { status: 400 });
  const file = path.join(LOCAL_ROOT(), key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buf);
  return new NextResponse(null, { status: 200 });
}
