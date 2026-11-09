import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { localSig, LOCAL_ROOT, s3Enabled } from "@/lib/storage";

// Development-only stand-in for an S3 signed GET (valid 10 minutes).
export async function GET(req) {
  if (s3Enabled()) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const u = new URL(req.url);
  const key = u.searchParams.get("key") || "";
  const exp = Number(u.searchParams.get("exp"));
  const sig = u.searchParams.get("sig");
  if (!key || key.includes("..") || exp < Date.now() / 1000 || sig !== localSig(["get", key, exp])) {
    return NextResponse.json({ error: "This link has expired. Open the file again from SUSALI." }, { status: 403 });
  }
  try {
    const buf = await fs.readFile(path.join(LOCAL_ROOT(), key));
    const name = (u.searchParams.get("name") || "file").replace(/["\r\n]/g, "");
    return new NextResponse(buf, {
      headers: {
        "Content-Type": u.searchParams.get("type") || "application/octet-stream",
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
