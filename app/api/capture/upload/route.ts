import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  UPLOAD_DIR,
  PUBLIC_BASE_URL,
  MAX_SIZE_BYTES,
  UPLOAD_TOKEN,
  extForMime,
  isAuthorized,
  buildRelPath,
} from "@/lib/capture-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── POST /api/capture/upload ──────────────────────────────────────────────
// Modtager en fil (multipart/form-data, felt "file") fra straye-capture's
// custom-provider, gemmer den persistent og returnerer en public URL.
//
// Auth: header `x-capture-token` (eller `Authorization: Bearer <token>`) skal
// matche env CAPTURE_UPLOAD_TOKEN.
//
// Svar (matcher cfx-capture's custom-provider parsing: data.url || data.link):
//   { success: true, url: "...", link: "...", path: "..." }
export async function POST(req: NextRequest) {
  if (!UPLOAD_TOKEN) {
    console.error("[capture/upload] CAPTURE_UPLOAD_TOKEN ikke sat — afviser");
    return NextResponse.json(
      { success: false, error: "upload not configured" },
      { status: 503 },
    );
  }

  const token =
    req.headers.get("x-capture-token") ??
    req.headers.get("authorization") ??
    null;
  if (!isAuthorized(token)) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid form-data" },
      { status: 400 },
    );
  }

  // straye-capture sender feltet "file" (custom.field). Fald tilbage til de
  // andre kendte feltnavne for robusthed.
  const entry =
    form.get("file") ?? form.get("image") ?? form.get("recording");
  if (!entry || typeof entry === "string") {
    return NextResponse.json(
      { success: false, error: "missing file" },
      { status: 400 },
    );
  }

  const file = entry as File;
  const ext = extForMime(file.type);
  if (!ext) {
    return NextResponse.json(
      { success: false, error: `unsupported type: ${file.type || "unknown"}` },
      { status: 415 },
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { success: false, error: "file too large", maxBytes: MAX_SIZE_BYTES },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) {
    return NextResponse.json(
      { success: false, error: "empty file" },
      { status: 400 },
    );
  }

  const relPath = buildRelPath(ext);
  const absPath = path.resolve(UPLOAD_DIR, relPath);

  try {
    await mkdir(path.dirname(absPath), { recursive: true });
    await writeFile(absPath, buf);
  } catch (err) {
    console.error("[capture/upload] skrivning fejlede:", err);
    return NextResponse.json(
      { success: false, error: "storage write failed" },
      { status: 500 },
    );
  }

  const url = `${PUBLIC_BASE_URL}/${relPath}`;
  return NextResponse.json({
    success: true,
    url,
    link: url,
    path: relPath,
    size: buf.length,
  });
}
