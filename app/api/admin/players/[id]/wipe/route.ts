import { NextRequest, NextResponse } from "next/server";
import { requireWiper } from "@/lib/admin-guard";
import { getEsxPool } from "@/lib/esx-db";
import { sendLog, LOG_COLORS, clip } from "@/lib/log-webhook";
import mysql from "mysql2/promise";

export const dynamic = "force-dynamic";

interface WipeBody {
  // Skal matche spillerens identifier — bekræftelse mod fejlklik.
  confirm?: string;
}

// Best-effort delete: kører én sætning, fanger fejl (manglende tabel/kolonne)
// så ét hul ikke stopper hele wipen. Returnerer antal ramte rækker.
async function tryDelete(
  pool: mysql.Pool,
  label: string,
  sql: string,
  args: unknown[],
  results: Record<string, number>,
  errors: string[]
): Promise<void> {
  try {
    const [res] = await pool.query<mysql.ResultSetHeader>(sql, args);
    results[label] = res.affectedRows ?? 0;
  } catch (e) {
    errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireWiper();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: WipeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const identifier = decodeURIComponent(params.id);

  if (String(body.confirm ?? "").trim() !== identifier) {
    return NextResponse.json(
      { error: "Bekræftelse matcher ikke spillerens identifier" },
      { status: 400 }
    );
  }

  const pool = getEsxPool();

  try {
    const [[userRow]] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT identifier, firstname, lastname FROM users WHERE identifier = ?",
      [identifier]
    );
    if (!userRow) {
      return NextResponse.json({ error: "Spiller ikke fundet" }, { status: 404 });
    }
    const playerName = [userRow.firstname, userRow.lastname]
      .filter(Boolean)
      .join(" ")
      .trim();

    const results: Record<string, number> = {};
    const errors: string[] = [];

    // Find spillerens huse FØR vi rører dem, så vi kan rydde deres ox_inventory-stashes.
    let houseIds: number[] = [];
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT id FROM allhousing WHERE owner = ?",
        [identifier]
      );
      houseIds = rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
    } catch {
      /* allhousing findes måske ikke */
    }

    // 1) Køretøjer
    await tryDelete(
      pool,
      "owned_vehicles",
      "DELETE FROM owned_vehicles WHERE owner = ?",
      [identifier],
      results,
      errors
    );

    // 2) Personlige stashes/lagre (ox_inventory keyet på owner)
    await tryDelete(
      pool,
      "ox_inventory (owner)",
      "DELETE FROM ox_inventory WHERE owner = ?",
      [identifier],
      results,
      errors
    );

    // 3) Hus-lagre (ox_inventory name = 'house_<id>') for spillerens huse
    if (houseIds.length > 0) {
      const names = houseIds.map((id) => `house_${id}`);
      await tryDelete(
        pool,
        "ox_inventory (house stashes)",
        "DELETE FROM ox_inventory WHERE name IN (?)",
        [names],
        results,
        errors
      );
    }

    // 4) Boliger — frigiv ejerskab (huset bliver ledigt igen, ikke slettet som property)
    await tryDelete(
      pool,
      "allhousing (frigivet)",
      "UPDATE allhousing SET owned = 0, owner = NULL, housekeys = NULL, inventory = NULL WHERE owner = ?",
      [identifier],
      results,
      errors
    );

    // 5) Licenser
    await tryDelete(
      pool,
      "user_licenses",
      "DELETE FROM user_licenses WHERE owner = ?",
      [identifier],
      results,
      errors
    );

    // 6) Selve brugeren — til sidst
    await tryDelete(
      pool,
      "users",
      "DELETE FROM users WHERE identifier = ?",
      [identifier],
      results,
      errors
    );

    const actor = guard.username ?? guard.discordId;

    await sendLog({
      embeds: [
        {
          title: "Admin · SPILLER WIPET",
          description: "Fuld wipe — user, køretøjer, boliger, stashes og licenser.",
          color: LOG_COLORS.rejected,
          fields: [
            { name: "Spiller", value: clip(playerName || identifier), inline: true },
            { name: "Identifier", value: clip(identifier, 256), inline: true },
            {
              name: "Resultat",
              value: clip(
                Object.entries(results)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("\n") || "—"
              ),
              inline: false,
            },
            ...(errors.length
              ? [{ name: "Fejl", value: clip(errors.join("\n")), inline: false }]
              : []),
            {
              name: "Udført af",
              value: `<@${guard.discordId}> (${clip(actor, 64)})`,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }).catch((e) => console.error("[admin/players/wipe] webhook failed:", e));

    return NextResponse.json({
      ok: true,
      identifier,
      results,
      errors,
      note: "Hvis spilleren er online skal de kickes/reconnecte. ESX cacher data i hukommelsen indtil de logger af.",
    });
  } catch (err) {
    console.error("[admin/players/wipe] DB error:", err);
    return NextResponse.json({ error: "Database fejl" }, { status: 500 });
  }
}
