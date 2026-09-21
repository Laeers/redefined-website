import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { requireAdmin } from "@/lib/admin-guard";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

// Returnerer distinct lister + counts til dropdowns/filtre i Logs-tabben.
// Vi kigger kun de seneste 30 dage for at holde queries hurtige.
//
// Læser fra hjemmesidens EGEN DB (redefined_web), hvor zaki-logging nu
// batch-ingester logs — IKKE længere spillets `essential`-DB.

export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const pool = getPool();
  try {
    const window = "created_at >= (NOW() - INTERVAL 30 DAY)";

    const [resources] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT resource AS v, COUNT(*) AS cnt FROM zaki_logs WHERE ${window} AND resource <> '' GROUP BY resource ORDER BY cnt DESC`
    );
    const [categories] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT category AS v, COUNT(*) AS cnt FROM zaki_logs WHERE ${window} AND category <> '' GROUP BY category ORDER BY cnt DESC`
    );
    const [severities] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT severity AS v, COUNT(*) AS cnt FROM zaki_logs WHERE ${window} AND severity <> '' GROUP BY severity ORDER BY FIELD(severity,'critical','error','warn','info','debug'), cnt DESC`
    );
    const [actions] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT action AS v, COUNT(*) AS cnt FROM zaki_logs WHERE ${window} AND action <> '' GROUP BY action ORDER BY cnt DESC LIMIT 200`
    );
    const [jobs] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT job AS v, COUNT(*) AS cnt FROM zaki_logs WHERE ${window} AND job IS NOT NULL AND job <> '' GROUP BY job ORDER BY cnt DESC LIMIT 100`
    );

    // overview-kort
    const [[stats24h]] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT
         COUNT(*) AS total,
         SUM(severity IN ('error','critical')) AS errors,
         SUM(severity = 'warn') AS warnings,
         (SELECT COUNT(*) FROM zaki_logs WHERE created_at >= (NOW() - INTERVAL 1 HOUR)) AS lastHour
       FROM zaki_logs
       WHERE created_at >= (NOW() - INTERVAL 1 DAY)`
    );

    return NextResponse.json({
      resources: (resources as mysql.RowDataPacket[]).map((r) => ({ value: r.v, count: Number(r.cnt) })),
      categories: (categories as mysql.RowDataPacket[]).map((r) => ({ value: r.v, count: Number(r.cnt) })),
      severities: (severities as mysql.RowDataPacket[]).map((r) => ({ value: r.v, count: Number(r.cnt) })),
      actions: (actions as mysql.RowDataPacket[]).map((r) => ({ value: r.v, count: Number(r.cnt) })),
      jobs: (jobs as mysql.RowDataPacket[]).map((r) => ({ value: r.v, count: Number(r.cnt) })),
      stats: {
        last24h: Number((stats24h as mysql.RowDataPacket).total ?? 0),
        errors24h: Number((stats24h as mysql.RowDataPacket).errors ?? 0),
        warnings24h: Number((stats24h as mysql.RowDataPacket).warnings ?? 0),
        lastHour: Number((stats24h as mysql.RowDataPacket).lastHour ?? 0),
      },
    });
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code !== "ER_NO_SUCH_TABLE") {
      console.error("[admin/logs/facets] DB error:", err);
    }
    return NextResponse.json({
      resources: [],
      categories: [],
      severities: [],
      actions: [],
      jobs: [],
      stats: { last24h: 0, errors24h: 0, warnings24h: 0, lastHour: 0 },
    });
  }
}
