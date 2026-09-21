import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getEsxPool } from "@/lib/esx-db";
import { normalizeInventory } from "@/lib/inventory-utils";
import mysql from "mysql2/promise";

export const dynamic = "force-dynamic";

function safeJson(val: string | null | undefined): unknown {
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

function itemMatchesQuery(itemName: string | undefined, query: string): boolean {
  return Boolean(itemName && itemName.toLowerCase().includes(query));
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const name = req.nextUrl.searchParams.get("name")?.trim().toLowerCase() ?? "";
  if (!name) return NextResponse.json({ players: [], vehicles: [], houses: [] });

  const pool = getEsxPool();
  try {
    const [userRows] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT identifier, firstname, lastname, inventory FROM users WHERE inventory IS NOT NULL"
    );

    const playerHits: { identifier: string; name: string; count: number }[] = [];
    for (const row of userRows) {
      const items = normalizeInventory(safeJson(row.inventory as string));
      for (const item of items) {
        if (itemMatchesQuery(item.name, name) && item.count > 0) {
          playerHits.push({
            identifier: row.identifier,
            name: [row.firstname, row.lastname].filter(Boolean).join(" ") || row.identifier,
            count: item.count,
          });
        }
      }
    }

    const vehicleHits: {
      plate: string;
      owner: string;
      ownerName: string;
      location: string;
      count: number;
    }[] = [];
    const vehicleSeen = new Set<string>();

    const pushVehicleHit = (hit: (typeof vehicleHits)[number]) => {
      const key = `${hit.plate}|${hit.location}`;
      if (vehicleSeen.has(key)) return;
      vehicleSeen.add(key);
      vehicleHits.push(hit);
    };

    try {
      const [colRows] = await pool.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM owned_vehicles");
      const cols = new Set(colRows.map((c) => c.Field as string));

      if (cols.has("trunk") || cols.has("glovebox")) {
        const fields = ["ov.plate", "ov.owner", "u.firstname", "u.lastname"];
        if (cols.has("trunk")) fields.push("ov.trunk");
        if (cols.has("glovebox")) fields.push("ov.glovebox");

        const [vehRows] = await pool.query<mysql.RowDataPacket[]>(
          `SELECT ${fields.join(", ")}
           FROM owned_vehicles ov
           LEFT JOIN users u ON u.identifier COLLATE utf8mb4_unicode_ci = ov.owner COLLATE utf8mb4_unicode_ci`
        );

        const locs: { col: "trunk" | "glovebox"; label: string }[] = [];
        if (cols.has("trunk")) locs.push({ col: "trunk", label: "kuffert" });
        if (cols.has("glovebox")) locs.push({ col: "glovebox", label: "handskerum" });

        for (const row of vehRows) {
          const ownerName = [row.firstname, row.lastname].filter(Boolean).join(" ") || row.owner;
          for (const { col, label } of locs) {
            const items = normalizeInventory(safeJson(row[col] as string));
            for (const item of items) {
              if (itemMatchesQuery(item.name, name) && item.count > 0) {
                pushVehicleHit({
                  plate: row.plate,
                  owner: row.owner,
                  ownerName,
                  location: label,
                  count: item.count,
                });
              }
            }
          }
        }
      }
    } catch {
      /* owned_vehicles may be unavailable */
    }

    const houseHits: { houseId: number; owner: string; ownerName: string; count: number }[] = [];
    const houseCounts = new Map<number, number>();

    try {
      const [stashRows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT name, data FROM ox_inventory
         WHERE (name LIKE 'house_%' OR name LIKE 'trunk%' OR name LIKE 'glove%')
           AND data IS NOT NULL AND data != '' AND data != '[]'`
      );

      const houseIdsFromStash = new Set<number>();
      const vehicleStashHits = new Map<string, { plate: string; location: "kuffert" | "handskerum"; count: number }>();

      for (const row of stashRows) {
        const stashName = row.name as string;
        const items = normalizeInventory(safeJson(row.data as string));
        let stashCount = 0;
        for (const item of items) {
          if (itemMatchesQuery(item.name, name) && item.count > 0) {
            stashCount += item.count;
          }
        }
        if (stashCount <= 0) continue;

        const houseMatch = /^house_(\d+)$/.exec(stashName);
        if (houseMatch) {
          const houseId = Number(houseMatch[1]);
          houseIdsFromStash.add(houseId);
          houseCounts.set(houseId, (houseCounts.get(houseId) ?? 0) + stashCount);
          continue;
        }

        if (stashName.startsWith("trunk")) {
          const plate = stashName.slice(5);
          vehicleStashHits.set(`${plate}|kuffert`, { plate, location: "kuffert", count: stashCount });
        } else if (stashName.startsWith("glove")) {
          const plate = stashName.slice(5);
          vehicleStashHits.set(`${plate}|handskerum`, { plate, location: "handskerum", count: stashCount });
        }
      }

      if (houseIdsFromStash.size > 0) {
        const ids = [...houseIdsFromStash];
        const [houseRows] = await pool.query<mysql.RowDataPacket[]>(
          `SELECT h.id, h.owner, h.ownername, u.firstname, u.lastname
           FROM allhousing h
           LEFT JOIN users u ON u.identifier COLLATE utf8mb4_unicode_ci = h.owner COLLATE utf8mb4_unicode_ci
           WHERE h.id IN (?)`,
          [ids]
        );

        for (const row of houseRows) {
          const count = houseCounts.get(row.id) ?? 0;
          if (count <= 0) continue;
          houseHits.push({
            houseId: row.id,
            owner: row.owner,
            ownerName:
              [row.firstname, row.lastname].filter(Boolean).join(" ") || row.ownername || row.owner,
            count,
          });
        }
      }

      if (vehicleStashHits.size > 0) {
        const plates = [...new Set([...vehicleStashHits.values()].map((v) => v.plate))];
        const [vehRows] = await pool.query<mysql.RowDataPacket[]>(
          `SELECT ov.plate, ov.owner, u.firstname, u.lastname
           FROM owned_vehicles ov
           LEFT JOIN users u ON u.identifier COLLATE utf8mb4_unicode_ci = ov.owner COLLATE utf8mb4_unicode_ci
           WHERE ov.plate IN (?)`,
          [plates]
        );

        const ownerByPlate = new Map(
          vehRows.map((r) => [
            r.plate as string,
            {
              owner: r.owner as string,
              ownerName:
                [r.firstname, r.lastname].filter(Boolean).join(" ") || (r.owner as string),
            },
          ])
        );

        for (const hit of vehicleStashHits.values()) {
          const ownerInfo = ownerByPlate.get(hit.plate);
          pushVehicleHit({
            plate: hit.plate,
            owner: ownerInfo?.owner ?? "",
            ownerName: ownerInfo?.ownerName ?? hit.plate,
            location: hit.location,
            count: hit.count,
          });
        }
      }
    } catch {
      /* ox_inventory may not exist */
    }

    // Legacy fallback: inventory direkte på allhousing-rækken
    if (houseHits.length === 0) {
      try {
        const [legacyRows] = await pool.query<mysql.RowDataPacket[]>(
          `SELECT h.id, h.owner, h.ownername, h.inventory, u.firstname, u.lastname
           FROM allhousing h
           LEFT JOIN users u ON u.identifier COLLATE utf8mb4_unicode_ci = h.owner COLLATE utf8mb4_unicode_ci
           WHERE h.owned = 1 AND h.inventory IS NOT NULL AND h.inventory != '' AND h.inventory != '[]'`
        );

        for (const row of legacyRows) {
          const items = normalizeInventory(safeJson(row.inventory as string));
          let count = 0;
          for (const item of items) {
            if (itemMatchesQuery(item.name, name) && item.count > 0) {
              count += item.count;
            }
          }
          if (count <= 0) continue;
          houseHits.push({
            houseId: row.id,
            owner: row.owner,
            ownerName:
              [row.firstname, row.lastname].filter(Boolean).join(" ") || row.ownername || row.owner,
            count,
          });
        }
      } catch {
        /* allhousing may not exist */
      }
    }

    playerHits.sort((a, b) => b.count - a.count);
    vehicleHits.sort((a, b) => b.count - a.count);
    houseHits.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      players: playerHits.slice(0, 50),
      vehicles: vehicleHits.slice(0, 50),
      houses: houseHits.slice(0, 50),
    });
  } catch (err) {
    console.error("[admin/search/item]", err);
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
