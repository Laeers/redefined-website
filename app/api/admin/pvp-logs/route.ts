import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getEsxPool } from "@/lib/esx-db";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

// ── GET /api/admin/pvp-logs ───────────────────────────────────────────────
// Pagineret + filterbar liste over PvP/death-logs fra zaki_pvp_logs.
//
// Query params:
//   q          — fri tekst (matcher offer/killer navn, discord ID, weapon)
//   type       — exact death_type (pvp, suicide, npc_or_env, environment)
//   killerJob  — exact killer_job (gentag for OR)
//   victimJob  — exact victim_job (gentag for OR)
//   from       — ISO date
//   to         — ISO date
//   page       — default 1
//   limit      — default 50, max 200
//
// Response inkluderer .facets med distinct killer/victim jobs (sidste 30 dage)
// så frontenden kan rendere multi-select dropdowns.

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

interface PvpRow extends RowDataPacket {
  id: number;
  created_at: Date | string;
  victim_source: number | null;
  victim_identifier: string | null;
  victim_license: string | null;
  victim_discord: string | null;
  victim_steam: string | null;
  victim_name: string | null;
  victim_job: string | null;
  victim_job_grade: number | null;
  victim_coords: string | null;
  victim_screenshot: string | null;
  victim_video: string | null;
  victim_inventory: string | null;
  killer_source: number | null;
  killer_identifier: string | null;
  killer_license: string | null;
  killer_discord: string | null;
  killer_steam: string | null;
  killer_name: string | null;
  killer_job: string | null;
  killer_job_grade: number | null;
  killer_coords: string | null;
  killer_screenshot: string | null;
  killer_video: string | null;
  killer_inventory: string | null;
  weapon: string | null;
  weapon_hash: number | null;
  distance: number | null;
  is_headshot: number;
  death_type: string;
}

function parseJsonSafe(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const type = sp.get("type");
  const killerJobs = sp.getAll("killerJob").filter(Boolean);
  const victimJobs = sp.getAll("victimJob").filter(Boolean);
  const from = sp.get("from");
  const to = sp.get("to");
  const page = Math.max(1, Number(sp.get("page") ?? "1"));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get("limit") ?? DEFAULT_LIMIT)));
  const offset = (page - 1) * limit;

  const where: string[] = [];
  const params: unknown[] = [];

  if (q) {
    const m = /^([a-z]+):(.+)$/i.exec(q);
    if (m) {
      const key = m[1].toLowerCase();
      const val = m[2].trim();
      if (key === "discord") {
        where.push("(victim_discord = ? OR killer_discord = ?)");
        params.push(val, val);
      } else if (key === "license") {
        where.push("(victim_license = ? OR killer_license = ?)");
        params.push(val, val);
      } else if (key === "weapon") {
        where.push("weapon = ?");
        params.push(val);
      } else {
        const like = `%${q.toLowerCase()}%`;
        where.push("(LOWER(victim_name) LIKE ? OR LOWER(killer_name) LIKE ? OR LOWER(weapon) LIKE ?)");
        params.push(like, like, like);
      }
    } else if (/^\d{15,21}$/.test(q)) {
      where.push("(victim_discord = ? OR killer_discord = ?)");
      params.push(q, q);
    } else {
      const like = `%${q.toLowerCase()}%`;
      where.push("(LOWER(victim_name) LIKE ? OR LOWER(killer_name) LIKE ? OR LOWER(weapon) LIKE ?)");
      params.push(like, like, like);
    }
  }

  if (type) {
    where.push("death_type = ?");
    params.push(type);
  }
  if (killerJobs.length) {
    where.push(`killer_job IN (${killerJobs.map(() => "?").join(",")})`);
    params.push(...killerJobs);
  }
  if (victimJobs.length) {
    where.push(`victim_job IN (${victimJobs.map(() => "?").join(",")})`);
    params.push(...victimJobs);
  }
  if (from) {
    where.push("created_at >= ?");
    params.push(from);
  }
  if (to) {
    where.push("created_at <= ?");
    params.push(to);
  }
  if (!q && !from && !to) {
    where.push("created_at >= (NOW() - INTERVAL 14 DAY)");
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const pool = getEsxPool();
  try {
    const [rows] = await pool.query<PvpRow[]>(
      `SELECT * FROM zaki_pvp_logs
        ${whereSql}
        ORDER BY id DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const [[countRow]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM zaki_pvp_logs ${whereSql}`,
      params,
    );

    const [[statsRow]] = await pool.query<RowDataPacket[]>(
      `SELECT
        SUM(CASE WHEN death_type = 'pvp' THEN 1 ELSE 0 END) AS pvp,
        SUM(CASE WHEN death_type = 'suicide' THEN 1 ELSE 0 END) AS suicide,
        SUM(CASE WHEN death_type = 'npc_or_env' THEN 1 ELSE 0 END) AS npc,
        SUM(CASE WHEN is_headshot = 1 THEN 1 ELSE 0 END) AS headshots,
        COUNT(*) AS total
       FROM zaki_pvp_logs
       WHERE created_at >= (NOW() - INTERVAL 24 HOUR)`,
    );

    // Facets: distinct killer- og victim-jobs (sidste 30 dage, med antal)
    const [killerJobRows] = await pool.query<RowDataPacket[]>(
      `SELECT killer_job AS job, COUNT(*) AS cnt FROM zaki_pvp_logs
        WHERE killer_job IS NOT NULL AND killer_job <> ''
          AND created_at >= (NOW() - INTERVAL 30 DAY)
        GROUP BY killer_job ORDER BY cnt DESC LIMIT 100`,
    );
    const [victimJobRows] = await pool.query<RowDataPacket[]>(
      `SELECT victim_job AS job, COUNT(*) AS cnt FROM zaki_pvp_logs
        WHERE victim_job IS NOT NULL AND victim_job <> ''
          AND created_at >= (NOW() - INTERVAL 30 DAY)
        GROUP BY victim_job ORDER BY cnt DESC LIMIT 100`,
    );

    const total = Number(countRow.cnt);

    const logs = rows.map((r) => ({
      id: Number(r.id),
      createdAt: r.created_at,
      deathType: r.death_type,
      weapon: r.weapon,
      weaponHash: r.weapon_hash,
      weaponItem: r.weapon_item,
      killVehicle: r.kill_vehicle,
      distance: r.distance,
      isHeadshot: r.is_headshot === 1,
      victim: {
        source: r.victim_source,
        identifier: r.victim_identifier,
        license: r.victim_license,
        discord: r.victim_discord,
        steam: r.victim_steam,
        name: r.victim_name,
        job: r.victim_job,
        jobGrade: r.victim_job_grade,
        coords: r.victim_coords,
        screenshotUrl: r.victim_screenshot,
        videoUrl: r.victim_video,
        inventory: parseJsonSafe(r.victim_inventory),
      },
      killer: r.killer_source != null || r.killer_identifier != null
        ? {
            source: r.killer_source,
            identifier: r.killer_identifier,
            license: r.killer_license,
            discord: r.killer_discord,
            steam: r.killer_steam,
            name: r.killer_name,
            job: r.killer_job,
            jobGrade: r.killer_job_grade,
            coords: r.killer_coords,
            screenshotUrl: r.killer_screenshot,
            videoUrl: r.killer_video,
            inventory: parseJsonSafe(r.killer_inventory),
          }
        : null,
    }));

    return NextResponse.json({
      logs,
      total,
      page,
      limit,
      stats24h: {
        pvp: Number(statsRow.pvp ?? 0),
        suicide: Number(statsRow.suicide ?? 0),
        npc: Number(statsRow.npc ?? 0),
        headshots: Number(statsRow.headshots ?? 0),
        total: Number(statsRow.total ?? 0),
      },
      facets: {
        killerJobs: killerJobRows.map((r) => ({ value: String(r.job), count: Number(r.cnt) })),
        victimJobs: victimJobRows.map((r) => ({ value: String(r.job), count: Number(r.cnt) })),
      },
    });
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({
        logs: [],
        total: 0,
        page,
        limit,
        stats24h: { pvp: 0, suicide: 0, npc: 0, headshots: 0, total: 0 },
        facets: { killerJobs: [], victimJobs: [] },
      });
    }
    console.error("[admin/pvp-logs] DB error:", err);
    return NextResponse.json(
      {
        logs: [],
        total: 0,
        page,
        limit,
        stats24h: { pvp: 0, suicide: 0, npc: 0, headshots: 0, total: 0 },
        facets: { killerJobs: [], victimJobs: [] },
        error: "Database fejl",
      },
      { status: 500 },
    );
  }
}
