import { NextRequest, NextResponse } from "next/server";
import { requireInventoryManager } from "@/lib/admin-guard";
import { getEsxPool } from "@/lib/esx-db";
import { normalizeInventory, removeItemBySlot, type OxItem } from "@/lib/inventory-utils";
import { sendLog, LOG_COLORS, clip } from "@/lib/log-webhook";
import mysql from "mysql2/promise";

export const dynamic = "force-dynamic";

type InventoryTarget =
  | "player"
  | "vehicle_trunk"
  | "vehicle_glovebox"
  | "stash"
  | "house";

interface RemoveBody {
  slot?: number;
  target?: InventoryTarget;
  plate?: string;
  stashName?: string;
  houseId?: number;
}

function safeJson(val: string | null | undefined): unknown {
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

const TARGET_LABELS: Record<InventoryTarget, string> = {
  player: "Spiller-inventar",
  vehicle_trunk: "Køretøj · kuffert",
  vehicle_glovebox: "Køretøj · handskerum",
  stash: "Stash/lager",
  house: "Bolig · lager",
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireInventoryManager();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: RemoveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const slot = Number(body.slot);
  const target = (body.target ?? "player") as InventoryTarget;
  if (!Number.isInteger(slot) || slot < 1) {
    return NextResponse.json({ error: "Ugyldigt slot" }, { status: 400 });
  }

  const identifier = decodeURIComponent(params.id);
  const pool = getEsxPool();

  try {
    const [[userRow]] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT identifier, firstname, lastname FROM users WHERE identifier = ?",
      [identifier]
    );
    if (!userRow) {
      return NextResponse.json({ error: "Spiller ikke fundet" }, { status: 404 });
    }

    const playerName = [userRow.firstname, userRow.lastname].filter(Boolean).join(" ").trim();
    let removed: OxItem | null = null;
    let inventory: OxItem[] = [];
    let locationLabel = TARGET_LABELS[target] ?? target;

    if (target === "player") {
      const [[row]] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT inventory FROM users WHERE identifier = ?",
        [identifier]
      );
      const raw = safeJson(row?.inventory as string);
      const result = removeItemBySlot(raw, slot);
      if (!result.removed) {
        return NextResponse.json({ error: "Item ikke fundet i det slot" }, { status: 404 });
      }
      await pool.query("UPDATE users SET inventory = ? WHERE identifier = ?", [
        JSON.stringify(result.updated),
        identifier,
      ]);
      removed = result.removed;
      inventory = normalizeInventory(result.updated);
    } else if (target === "vehicle_trunk" || target === "vehicle_glovebox") {
      const plate = String(body.plate ?? "").trim();
      if (!plate) {
        return NextResponse.json({ error: "Manglende plade" }, { status: 400 });
      }
      const column = target === "vehicle_trunk" ? "trunk" : "glovebox";
      const [[veh]] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT plate, ${column} AS inv FROM owned_vehicles WHERE plate = ? AND owner = ? LIMIT 1`,
        [plate, identifier]
      );
      if (!veh) {
        return NextResponse.json({ error: "Køretøj ikke fundet for spilleren" }, { status: 404 });
      }
      const raw = safeJson(veh.inv as string);
      const result = removeItemBySlot(raw, slot);
      if (!result.removed) {
        return NextResponse.json({ error: "Item ikke fundet i det slot" }, { status: 404 });
      }
      await pool.query(`UPDATE owned_vehicles SET ${column} = ? WHERE plate = ? AND owner = ?`, [
        JSON.stringify(result.updated),
        plate,
        identifier,
      ]);
      removed = result.removed;
      inventory = normalizeInventory(result.updated);
      locationLabel = `${locationLabel} · ${plate}`;
    } else if (target === "stash") {
      const stashName = String(body.stashName ?? "").trim();
      if (!stashName) {
        return NextResponse.json({ error: "Manglende stash-navn" }, { status: 400 });
      }
      const [[stash]] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT name, data FROM ox_inventory WHERE owner = ? AND name = ? LIMIT 1",
        [identifier, stashName]
      );
      if (!stash) {
        return NextResponse.json({ error: "Stash ikke fundet for spilleren" }, { status: 404 });
      }
      const raw = safeJson(stash.data as string);
      const result = removeItemBySlot(raw, slot);
      if (!result.removed) {
        return NextResponse.json({ error: "Item ikke fundet i det slot" }, { status: 404 });
      }
      await pool.query("UPDATE ox_inventory SET data = ? WHERE owner = ? AND name = ?", [
        JSON.stringify(result.updated),
        identifier,
        stashName,
      ]);
      removed = result.removed;
      inventory = normalizeInventory(result.updated);
      locationLabel = `${locationLabel} · ${stashName}`;
    } else if (target === "house") {
      const houseId = Number(body.houseId);
      if (!Number.isInteger(houseId) || houseId < 1) {
        return NextResponse.json({ error: "Ugyldigt hus-id" }, { status: 400 });
      }
      const [[house]] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT id FROM allhousing WHERE id = ? AND owner = ? AND owned = 1 LIMIT 1",
        [houseId, identifier]
      );
      if (!house) {
        return NextResponse.json({ error: "Bolig ikke fundet for spilleren" }, { status: 404 });
      }

      const oxName = `house_${houseId}`;
      const [[oxRow]] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT data FROM ox_inventory WHERE name = ? LIMIT 1",
        [oxName]
      );

      if (oxRow) {
        const raw = safeJson(oxRow.data as string);
        const result = removeItemBySlot(raw, slot);
        if (!result.removed) {
          return NextResponse.json({ error: "Item ikke fundet i det slot" }, { status: 404 });
        }
        await pool.query("UPDATE ox_inventory SET data = ? WHERE name = ?", [
          JSON.stringify(result.updated),
          oxName,
        ]);
        removed = result.removed;
        inventory = normalizeInventory(result.updated);
      } else {
        const [[legacy]] = await pool.query<mysql.RowDataPacket[]>(
          "SELECT inventory FROM allhousing WHERE id = ? AND owner = ? LIMIT 1",
          [houseId, identifier]
        );
        const raw = safeJson(legacy?.inventory as string);
        const result = removeItemBySlot(raw, slot);
        if (!result.removed) {
          return NextResponse.json({ error: "Item ikke fundet i det slot" }, { status: 404 });
        }
        await pool.query("UPDATE allhousing SET inventory = ? WHERE id = ? AND owner = ?", [
          JSON.stringify(result.updated),
          houseId,
          identifier,
        ]);
        removed = result.removed;
        inventory = normalizeInventory(result.updated);
      }
      locationLabel = `${locationLabel} · #${houseId}`;
    } else {
      return NextResponse.json({ error: "Ukendt target" }, { status: 400 });
    }

    const actor = guard.username ?? guard.discordId;

    await sendLog({
      embeds: [
        {
          title: "Admin · item fjernet",
          color: LOG_COLORS.rejected,
          fields: [
            { name: "Spiller", value: clip(playerName || identifier), inline: true },
            { name: "Lokation", value: clip(locationLabel), inline: true },
            { name: "Item", value: clip(`${removed.name} × ${removed.count}`), inline: true },
            { name: "Slot", value: String(slot), inline: true },
            { name: "Identifier", value: clip(identifier, 256), inline: false },
            { name: "Udført af", value: `<@${guard.discordId}> (${clip(actor, 64)})`, inline: false },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }).catch((e) => console.error("[admin/inventory/remove] webhook failed:", e));

    return NextResponse.json({
      ok: true,
      target,
      plate: body.plate ?? null,
      stashName: body.stashName ?? null,
      houseId: body.houseId ?? null,
      inventory,
      removed,
      note: "Hvis spilleren/køretøjet er online skal de reconnecte før ændringen ses in-game.",
    });
  } catch (err) {
    console.error("[admin/inventory/remove] DB error:", err);
    return NextResponse.json({ error: "Database fejl" }, { status: 500 });
  }
}
