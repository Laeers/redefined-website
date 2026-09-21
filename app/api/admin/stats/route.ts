import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getEsxPool } from "@/lib/esx-db";
import mysql from "mysql2/promise";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const pool = getEsxPool();
  try {
    const [[players]] = await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM users");
    const [[vehicles]] = await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM owned_vehicles");

    let houses = 0;
    try {
      const [[row]] = await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM allhousing WHERE owned = 1");
      houses = Number(row.cnt);
    } catch { /* no housing table */ }

    // Sum all bank + money from accounts JSON
    const [accountRows] = await pool.query<mysql.RowDataPacket[]>("SELECT accounts FROM users WHERE accounts IS NOT NULL");
    let totalBank = 0, totalCash = 0, totalBlack = 0;
    for (const row of accountRows) {
      try {
        const acc = JSON.parse(row.accounts as string) as Record<string, number>;
        totalBank += acc.bank ?? 0;
        totalCash += acc.money ?? 0;
        totalBlack += acc.black_money ?? 0;
      } catch { /* skip */ }
    }

    // Top jobs
    const [jobRows] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT job, COUNT(*) AS cnt FROM users GROUP BY job ORDER BY cnt DESC LIMIT 8"
    );

    return NextResponse.json({
      players: Number(players.cnt),
      vehicles: Number(vehicles.cnt),
      houses,
      economy: { bank: totalBank, cash: totalCash, black: totalBlack },
      topJobs: jobRows.map((r) => ({ job: r.job, count: Number(r.cnt) })),
    });
  } catch (err) {
    console.error("[admin/stats]", err);
    return NextResponse.json({ error: "Database fejl" }, { status: 500 });
  }
}
