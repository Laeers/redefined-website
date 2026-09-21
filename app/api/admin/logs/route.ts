import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { requireAdmin } from "@/lib/admin-guard";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── GET /api/admin/logs ───────────────────────────────────────────────────────
// Pagination + filters for the logs tab.
//
// Query params:
//   q          — fri tekst (matcher search_text + alle id-felter)
//   resource   — exact match (gentag for OR)
//   category   — exact match (gentag for OR)
//   severity   — exact match (gentag for OR)
//   action     — exact match (gentag for OR)
//   job        — exact match (gentag for OR)
//   from       — ISO date or YYYY-MM-DD
//   to         — ISO date or YYYY-MM-DD
//   page       — default 1
//   limit      — default 50, max 200

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const resources = sp.getAll("resource").filter(Boolean);
  const categories = sp.getAll("category").filter(Boolean);
  const severities = sp.getAll("severity").filter(Boolean);
  const actions = sp.getAll("action").filter(Boolean);
  const jobs = sp.getAll("job").filter(Boolean);
  const from = sp.get("from");
  const to = sp.get("to");
  const page = Math.max(1, Number(sp.get("page") ?? "1"));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get("limit") ?? DEFAULT_LIMIT)));
  const offset = (page - 1) * limit;

  const where: string[] = [];
  const params: unknown[] = [];

  if (q) {
    // dekod kvalifikatorer som "discord:123" eller "license:xxx"
    const m = /^([a-z]+):(.+)$/i.exec(q);
    if (m) {
      const key = m[1].toLowerCase();
      const val = m[2].trim();
      if (key === "discord") {
        where.push("discord = ?");
        params.push(val);
      } else if (key === "steam") {
        where.push("steam = ?");
        params.push(val);
      } else if (key === "license") {
        where.push("(license = ? OR identifier = ?)");
        params.push(val, "license:" + val);
      } else if (key === "identifier") {
        where.push("identifier = ?");
        params.push(val);
      } else if (key === "plate") {
        where.push("plate = ?");
        params.push(val.toUpperCase());
      } else if (key === "item") {
        where.push("item = ?");
        params.push(val);
      } else if (key === "weapon") {
        where.push("weapon = ?");
        params.push(val);
      } else {
        // ukendt kvalifikator → fri tekst
        const like = `%${q.toLowerCase()}%`;
        where.push("search_text LIKE ?");
        params.push(like);
      }
    } else {
      // bare-tal → discord ID heuristik
      if (/^\d{15,21}$/.test(q)) {
        where.push("discord = ?");
        params.push(q);
      } else {
        const like = `%${q.toLowerCase()}%`;
        where.push("search_text LIKE ?");
        params.push(like);
      }
    }
  }

  if (resources.length) {
    where.push(`resource IN (${resources.map(() => "?").join(",")})`);
    params.push(...resources);
  }
  if (categories.length) {
    where.push(`category IN (${categories.map(() => "?").join(",")})`);
    params.push(...categories);
  }
  if (severities.length) {
    where.push(`severity IN (${severities.map(() => "?").join(",")})`);
    params.push(...severities);
  }
  if (actions.length) {
    where.push(`action IN (${actions.map(() => "?").join(",")})`);
    params.push(...actions);
  }
  if (jobs.length) {
    where.push(`job IN (${jobs.map(() => "?").join(",")})`);
    params.push(...jobs);
  }
  if (from) {
    where.push("created_at >= ?");
    params.push(from);
  }
  if (to) {
    where.push("created_at <= ?");
    params.push(to);
  }

  // Hvis ingen søgning og intet date-filter, default til sidste 7 dage
  if (!q && !from && !to) {
    where.push("created_at >= (NOW() - INTERVAL 7 DAY)");
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const pool = getPool();
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, created_at, resource, category, action, severity, message,
              source, identifier, license, steam, discord, player_name, esx_name, job, job_grade,
              target_identifier, target_discord, target_name,
              amount, item, weapon, plate, coords, metadata_json, screenshot_url
         FROM zaki_logs
         ${whereSql}
         ORDER BY id DESC
         LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[countRow]] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM zaki_logs ${whereSql}`,
      params
    );

    const total = Number((countRow as mysql.RowDataPacket).cnt);

    const logs = (rows as mysql.RowDataPacket[]).map((r) => ({
      id: Number(r.id),
      createdAt: r.created_at,
      resource: r.resource ?? "",
      category: r.category ?? "",
      action: r.action ?? "",
      severity: r.severity ?? "info",
      message: r.message ?? null,
      source: r.source ?? null,
      identifier: r.identifier ?? null,
      license: r.license ?? null,
      steam: r.steam ?? null,
      discord: r.discord ?? null,
      playerName: r.player_name ?? null,
      esxName: r.esx_name ?? null,
      job: r.job ?? null,
      jobGrade: r.job_grade ?? null,
      targetIdentifier: r.target_identifier ?? null,
      targetDiscord: r.target_discord ?? null,
      targetName: r.target_name ?? null,
      amount: r.amount ?? null,
      item: r.item ?? null,
      weapon: r.weapon ?? null,
      plate: r.plate ?? null,
      coords: r.coords ?? null,
      metadata: parseJson(r.metadata_json),
      screenshotUrl: (r.screenshot_url as string) || null,
      screenshotInherited: false,
    }));

    // Fallback-screenshot: logs uden eget billede arver spillerens SENESTE
    // screenshot (≤ denne sides nyeste id), så HVER række viser "det sidst tagne
    // billede" af spilleren. Gøres her i API'et — kræver ingen FiveM/tx-genstart.
    // Matcher på identifier (indekseret) og henter alle sidens spillere i ét kald.
    const needShot = logs.filter((l) => !l.screenshotUrl && l.identifier);
    if (needShot.length) {
      const ids = Array.from(new Set(needShot.map((l) => l.identifier as string)));
      const maxId = Number((rows as mysql.RowDataPacket[])[0]?.id) || 0;
      try {
        const [shotRows] = await pool.query<mysql.RowDataPacket[]>(
          `SELECT t.identifier, t.screenshot_url
             FROM zaki_logs t
             JOIN (
               SELECT identifier, MAX(id) AS mid
                 FROM zaki_logs
                WHERE identifier IN (${ids.map(() => "?").join(",")})
                  AND screenshot_url IS NOT NULL AND screenshot_url <> ''
                  AND id <= ?
                GROUP BY identifier
             ) m ON t.id = m.mid`,
          [...ids, maxId]
        );
        const shotMap = new Map<string, string>();
        for (const sr of shotRows as mysql.RowDataPacket[]) {
          if (sr.identifier && sr.screenshot_url) {
            shotMap.set(String(sr.identifier), String(sr.screenshot_url));
          }
        }
        for (const l of logs) {
          if (!l.screenshotUrl && l.identifier) {
            const s = shotMap.get(l.identifier as string);
            if (s) {
              l.screenshotUrl = s;
              l.screenshotInherited = true;
            }
          }
        }
      } catch (e) {
        // best-effort: et fejlet fallback-opslag må aldrig vælte selve logs-svaret
        console.error("[admin/logs] screenshot-fallback fejl:", e);
      }
    }

    return NextResponse.json({ logs, total, page, limit });
  } catch (err) {
    // Hvis tabellen ikke findes endnu (zaki-logging ikke startet på FiveM), returnér tomt
    // i stedet for 500, så UI'en kan rendere "ingen logs" pænt.
    const code = (err as { code?: string } | null)?.code;
    if (code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({ logs: [], total: 0, page, limit });
    }
    console.error("[admin/logs] DB error:", err);
    return NextResponse.json(
      { logs: [], total: 0, page, limit, error: "Database fejl" },
      { status: 500 }
    );
  }
}

function parseJson(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}
