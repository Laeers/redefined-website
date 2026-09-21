import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getEsxPool } from "@/lib/esx-db";
import mysql from "mysql2/promise";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });

  const pool = getEsxPool();
  try {
    // Detect optional columns
    const [colRows] = await pool.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM owned_vehicles");
    const cols = new Set(colRows.map((c) => c.Field as string));
    const hasStored = cols.has("stored");
    const hasJob = cols.has("job");

    const select = [
      "ov.plate",
      "ov.vehicle",
      "ov.owner",
      hasStored ? "ov.stored" : "0 AS stored",
      hasJob ? "ov.job" : "NULL AS job",
      "u.firstname",
      "u.lastname",
    ].join(", ");

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT ${select}
       FROM owned_vehicles ov
       LEFT JOIN users u ON u.identifier COLLATE utf8mb4_unicode_ci = ov.owner COLLATE utf8mb4_unicode_ci
       WHERE ov.plate LIKE ?
       LIMIT 30`,
      [`%${q}%`]
    );

    const results = rows.map((r) => {
      let model = "ukendt";
      try {
        model = (JSON.parse(r.vehicle as string) as { model?: string })?.model ?? "ukendt";
      } catch { /* */ }
      return {
        plate: r.plate,
        model,
        stored: Boolean(r.stored),
        job: r.job ?? null,
        owner: r.owner,
        ownerName: [r.firstname, r.lastname].filter(Boolean).join(" ") || r.owner,
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[admin/search/plate]", err);
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
