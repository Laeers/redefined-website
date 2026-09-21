import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getEsxPool } from "@/lib/esx-db";
import mysql from "mysql2/promise";

export const dynamic = "force-dynamic";

interface OxItem {
  name: string;
  count: number;
  slot: number;
  metadata?: Record<string, unknown>;
}

function safeJson(val: string | null | undefined): unknown {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

function normalizeInventory(raw: unknown): OxItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return (raw as OxItem[]).filter((i) => i && i.count > 0);
  if (typeof raw === "object") {
    return Object.values(raw as Record<string, OxItem>).filter((i) => i && i.count > 0);
  }
  return [];
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const pool = getEsxPool();

  try {
    let rows: mysql.RowDataPacket[];
    if (!q) {
      [rows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT h.id, h.owner, h.ownername, h.owned, h.price, h.shell, h.lastActive,
                u.firstname, u.lastname
         FROM allhousing h
         LEFT JOIN users u ON u.identifier COLLATE utf8mb4_unicode_ci = h.owner COLLATE utf8mb4_unicode_ci
         WHERE h.owned = 1
         ORDER BY h.id DESC LIMIT 50`
      );
    } else {
      [rows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT h.id, h.owner, h.ownername, h.owned, h.price, h.shell, h.lastActive,
                u.firstname, u.lastname
         FROM allhousing h
         LEFT JOIN users u ON u.identifier COLLATE utf8mb4_unicode_ci = h.owner COLLATE utf8mb4_unicode_ci
         WHERE h.owned = 1 AND (
           h.id = ? OR h.owner LIKE ? OR h.ownername LIKE ?
           OR CONCAT(IFNULL(u.firstname,''), ' ', IFNULL(u.lastname,'')) LIKE ?
         )
         ORDER BY h.id ASC LIMIT 50`,
        [isNaN(Number(q)) ? -1 : Number(q), `%${q}%`, `%${q}%`, `%${q}%`]
      );
    }

    const stashByHouseId = new Map<number, { items: OxItem[]; updated: string | null }>();
    if (rows.length > 0) {
      const stashNames = rows.map((r) => `house_${r.id}`);
      try {
        const [stashRows] = await pool.query<mysql.RowDataPacket[]>(
          `SELECT name, data, lastupdated FROM ox_inventory WHERE name IN (?)`,
          [stashNames]
        );
        for (const s of stashRows) {
          const m = /^house_(\d+)$/.exec(s.name as string);
          if (!m) continue;
          stashByHouseId.set(Number(m[1]), {
            items: normalizeInventory(safeJson(s.data as string)),
            updated: s.lastupdated ? new Date(s.lastupdated).toISOString() : null,
          });
        }
      } catch { /* ox_inventory may not exist */ }
    }

    const results = rows.map((r) => {
      const stash = stashByHouseId.get(r.id);
      return {
        id: r.id,
        owner: r.owner,
        ownerName: [r.firstname, r.lastname].filter(Boolean).join(" ") || r.ownername || r.owner,
        price: r.price,
        shell: r.shell,
        lastActive: r.lastActive,
        items: stash?.items ?? [],
        inventoryUpdated: stash?.updated ?? null,
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[admin/search/house]", err);
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err), results: [] }, { status: 200 });
  }
}
