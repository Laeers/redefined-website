import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureLogKeyColumn() {
  const pool = getPool();
  await pool.query(
    "ALTER TABLE zaki_logs ADD COLUMN IF NOT EXISTS log_key VARCHAR(48) NULL AFTER search_text"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_log_key ON zaki_logs (log_key)"
  );
}

// PATCH /api/ingest/logs/screenshot
// Vedhæfter screenshot_url til en log-række identificeret via log_key (FiveM
// batched ingest returnerer ikke insert-id). Auth: x-ingest-token.

export async function PATCH(req: NextRequest) {
  const expected = process.env.LOG_INGEST_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "ingest disabled" }, { status: 503 });
  }
  const token = req.headers.get("x-ingest-token");
  if (!token || token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const logKey =
    typeof (body as { log_key?: unknown })?.log_key === "string"
      ? (body as { log_key: string }).log_key.trim()
      : "";
  const screenshotUrl =
    typeof (body as { screenshot_url?: unknown })?.screenshot_url === "string"
      ? (body as { screenshot_url: string }).screenshot_url.trim()
      : "";

  if (!logKey || !screenshotUrl) {
    return NextResponse.json(
      { error: "log_key and screenshot_url required" },
      { status: 400 }
    );
  }
  if (screenshotUrl.length > 512) {
    return NextResponse.json({ error: "screenshot_url too long" }, { status: 400 });
  }

  try {
    const pool = getPool();
    await ensureLogKeyColumn();
    const [result] = await pool.query<ResultSetHeader>(
      "UPDATE zaki_logs SET screenshot_url = ? WHERE log_key = ? LIMIT 1",
      [screenshotUrl, logKey]
    );
    const affected = result.affectedRows ?? 0;

    if (affected === 0) {
      return NextResponse.json({ error: "log not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ingest/logs/screenshot] DB error:", err);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
