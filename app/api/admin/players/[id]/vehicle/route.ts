import { NextRequest, NextResponse } from "next/server";
import { requireInventoryManager } from "@/lib/admin-guard";
import { getEsxPool } from "@/lib/esx-db";
import { sendLog, LOG_COLORS, clip } from "@/lib/log-webhook";
import mysql from "mysql2/promise";

export const dynamic = "force-dynamic";

interface RemoveVehicleBody {
  plate?: string;
}

function safeJson(val: string | null | undefined): unknown {
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

// Fjern et køretøj fra en spiller. Samme permission som inventar-redigering
// (requireInventoryManager / canManageInventory).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireInventoryManager();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: RemoveVehicleBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const plate = String(body.plate ?? "").trim();
  if (!plate) {
    return NextResponse.json({ error: "Manglende plade" }, { status: 400 });
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

    const [[veh]] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT plate, vehicle FROM owned_vehicles WHERE plate = ? AND owner = ? LIMIT 1",
      [plate, identifier]
    );
    if (!veh) {
      return NextResponse.json(
        { error: "Køretøj ikke fundet for spilleren" },
        { status: 404 }
      );
    }

    const vehData = safeJson(veh.vehicle as string) as Record<string, unknown> | null;
    const model = String(vehData?.model ?? vehData?.name ?? "ukendt");

    const [result] = await pool.query<mysql.ResultSetHeader>(
      "DELETE FROM owned_vehicles WHERE plate = ? AND owner = ?",
      [plate, identifier]
    );

    if (!result.affectedRows) {
      return NextResponse.json(
        { error: "Køretøj kunne ikke fjernes" },
        { status: 409 }
      );
    }

    const playerName = [userRow.firstname, userRow.lastname]
      .filter(Boolean)
      .join(" ")
      .trim();
    const actor = guard.username ?? guard.discordId;

    await sendLog({
      embeds: [
        {
          title: "Admin · køretøj fjernet",
          color: LOG_COLORS.rejected,
          fields: [
            { name: "Spiller", value: clip(playerName || identifier), inline: true },
            { name: "Plade", value: clip(plate), inline: true },
            { name: "Model", value: clip(model), inline: true },
            { name: "Identifier", value: clip(identifier, 256), inline: false },
            {
              name: "Udført af",
              value: `<@${guard.discordId}> (${clip(actor, 64)})`,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }).catch((e) => console.error("[admin/vehicle/remove] webhook failed:", e));

    return NextResponse.json({
      ok: true,
      plate,
      note: "Hvis køretøjet er ude/spawnet skal det despawne (eller spilleren reconnecte) før det forsvinder in-game.",
    });
  } catch (err) {
    console.error("[admin/vehicle/remove] DB error:", err);
    return NextResponse.json({ error: "Database fejl" }, { status: 500 });
  }
}
