import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdmin, canManageInventory, canWipePlayer } from "@/lib/admin-guard";
import { authOptions } from "@/lib/auth";
import { getEsxPool } from "@/lib/esx-db";
import { normalizeInventory, type OxItem } from "@/lib/inventory-utils";
import mysql from "mysql2/promise";

export const dynamic = "force-dynamic";

function safeJson(val: string | null | undefined): unknown {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const identifier = decodeURIComponent(params.id);
  const pool = getEsxPool();

  try {
    const [[userRow]] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT identifier, firstname, lastname, dateofbirth, sex, job, job_grade, \`group\`,
              accounts, inventory, metadata, position, ssn
       FROM users WHERE identifier = ?`,
      [identifier]
    );

    if (!userRow) {
      return NextResponse.json({ error: "Spiller ikke fundet" }, { status: 404 });
    }

    // Detect optional columns (stored/job may not exist)
    let vehicleRows: mysql.RowDataPacket[] = [];
    try {
      const [colRows] = await pool.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM owned_vehicles");
      const cols = new Set(colRows.map((c) => c.Field as string));
      const sel = [
        "plate",
        "vehicle",
        cols.has("stored") ? "stored" : "0 AS stored",
        cols.has("job") ? "job" : "NULL AS job",
        cols.has("trunk") ? "trunk" : "NULL AS trunk",
        cols.has("glovebox") ? "glovebox" : "NULL AS glovebox",
      ].join(", ");
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT ${sel} FROM owned_vehicles WHERE owner = ?`,
        [identifier]
      );
      vehicleRows = rows;
    } catch (e) {
      console.warn("[admin/players/id] owned_vehicles query failed:", e);
    }

    let housingRows: mysql.RowDataPacket[] = [];
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT id, owned, price, shell, inventory, housekeys, garage, lastActive
         FROM allhousing WHERE owner = ? AND owned = 1`,
        [identifier]
      );
      housingRows = rows;
    } catch { /* table may not exist */ }

    // Hent stash-indhold for de huse vi netop fandt fra ox_inventory.
    // Husets stash gemmes under name = 'house_<id>' (samme system som
    // Boliger-tab'en i admin-search).
    const houseStashes = new Map<number, { items: OxItem[]; updated: string | null }>();
    if (housingRows.length > 0) {
      const names = housingRows.map((h) => `house_${h.id}`);
      try {
        const [hsRows] = await pool.query<mysql.RowDataPacket[]>(
          `SELECT name, data, lastupdated FROM ox_inventory WHERE name IN (?)`,
          [names]
        );
        for (const s of hsRows) {
          const m = /^house_(\d+)$/.exec(s.name as string);
          if (!m) continue;
          houseStashes.set(Number(m[1]), {
            items: normalizeInventory(safeJson(s.data as string)),
            updated: s.lastupdated ? new Date(s.lastupdated).toISOString() : null,
          });
        }
      } catch { /* ox_inventory may not exist */ }
    }

    let stashRows: mysql.RowDataPacket[] = [];
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT name, data, lastupdated FROM ox_inventory WHERE owner = ?`,
        [identifier]
      );
      stashRows = rows;
    } catch { /* table may not exist */ }

    let licenseRows: mysql.RowDataPacket[] = [];
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT ul.type, l.label FROM user_licenses ul
         LEFT JOIN licenses l ON l.type = ul.type
         WHERE ul.owner = ?`,
        [identifier]
      );
      licenseRows = rows;
    } catch { /* table may not exist */ }

    const user = {
      identifier: userRow.identifier,
      firstname: userRow.firstname ?? "",
      lastname: userRow.lastname ?? "",
      dateofbirth: userRow.dateofbirth ?? "",
      sex: userRow.sex ?? "",
      job: userRow.job ?? "unemployed",
      job_grade: userRow.job_grade ?? 0,
      group: userRow.group ?? "user",
      ssn: userRow.ssn ?? "",
      accounts: safeJson(userRow.accounts as string) as Record<string, number> | null,
      inventory: normalizeInventory(safeJson(userRow.inventory as string)),
      metadata: safeJson(userRow.metadata as string),
    };

    const vehicles = (vehicleRows as mysql.RowDataPacket[]).map((v) => ({
      plate: v.plate,
      vehicle: safeJson(v.vehicle as string) as Record<string, unknown> | null,
      stored: Boolean(v.stored),
      job: v.job ?? null,
      trunk: normalizeInventory(safeJson(v.trunk as string)),
      glovebox: normalizeInventory(safeJson(v.glovebox as string)),
    }));

    // Parse housekeys (gemt som JSON i allhousing) til en flad liste
    // af identifiers. Format fra zaki-housing er:
    //   [ { identifier = 'license:abc', ... }, ... ]
    // Vi dropper ejeren selv så vi kun viser dem med "ekstra adgang".
    const housingParsed = housingRows.map((h) => {
      const raw = safeJson(h.housekeys as string);
      const keys: string[] = [];
      if (Array.isArray(raw)) {
        for (const k of raw) {
          if (k && typeof k === "object" && "identifier" in k) {
            const id = String((k as Record<string, unknown>).identifier ?? "");
            if (id && id !== identifier) keys.push(id);
          } else if (typeof k === "string" && k !== identifier) {
            keys.push(k);
          }
        }
      }
      // Legacy fallback: inventory direkte på allhousing-rækken hvis
      // ox_inventory ikke har en post for huset.
      const stashFromOx = houseStashes.get(Number(h.id));
      const fallbackInv = normalizeInventory(safeJson(h.inventory as string));
      return {
        id: h.id,
        owned: Boolean(h.owned),
        price: h.price,
        shell: h.shell,
        inventory: stashFromOx?.items.length ? stashFromOx.items : fallbackInv,
        inventoryUpdated: stashFromOx?.updated ?? null,
        lastActive: h.lastActive,
        keyIdentifiers: Array.from(new Set(keys)),
      };
    });

    // Slå navne op for alle key-identifiers så vi kan vise dem inline +
    // linke direkte til deres player-page.
    const allKeyIds = Array.from(
      new Set(housingParsed.flatMap((h) => h.keyIdentifiers))
    );
    const keyNameMap = new Map<string, string>();
    if (allKeyIds.length > 0) {
      try {
        const [keyRows] = await pool.query<mysql.RowDataPacket[]>(
          `SELECT identifier, firstname, lastname FROM users WHERE identifier IN (?)`,
          [allKeyIds]
        );
        for (const r of keyRows) {
          const name = [r.firstname, r.lastname].filter(Boolean).join(" ").trim();
          if (name) keyNameMap.set(String(r.identifier), name);
        }
      } catch { /* ignore */ }
    }

    const housing = housingParsed.map((h) => ({
      id: h.id,
      owned: h.owned,
      price: h.price,
      shell: h.shell,
      inventory: h.inventory,
      inventoryUpdated: h.inventoryUpdated,
      lastActive: h.lastActive,
      keys: h.keyIdentifiers.map((id) => ({
        identifier: id,
        name: keyNameMap.get(id) ?? null,
      })),
    }));

    const stashes = stashRows.map((s) => ({
      name: s.name,
      items: normalizeInventory(safeJson(s.data as string)),
      lastupdated: s.lastupdated,
    }));

    const licenses = licenseRows.map((l) => ({
      type: l.type,
      label: l.label ?? l.type,
    }));

    const session = await getServerSession(authOptions);
    const discordId = session?.user?.discordId;
    const manageInventory = discordId ? await canManageInventory(discordId) : false;
    const wipePlayer = discordId ? await canWipePlayer(discordId) : false;

    return NextResponse.json({
      user,
      vehicles,
      housing,
      stashes,
      licenses,
      permissions: { canManageInventory: manageInventory, canWipePlayer: wipePlayer },
    });
  } catch (err) {
    console.error("[admin/players/id] DB error:", err);
    return NextResponse.json({ error: "Database fejl" }, { status: 500 });
  }
}
