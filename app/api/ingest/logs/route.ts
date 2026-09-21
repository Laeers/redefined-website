import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── POST /api/ingest/logs ─────────────────────────────────────────────────────
// Batched log-ingest fra FiveM (zaki-logging). Skriver til hjemmesidens EGEN
// database (redefined_web.zaki_logs) i stedet for spillets `essential`-DB, så
// log-belastning (skriv + admin-læsninger) holdes helt væk fra gameplay-DB'en.
//
// Auth: delt hemmelighed i header `x-ingest-token` == process.env.LOG_INGEST_TOKEN.
// Body: { logs: Row[] } hvor hver Row matcher kolonnerne nedenfor (manglende
//       felter bliver NULL). created_at sættes af DB'en (CURRENT_TIMESTAMP(3)).

const MAX_BATCH = 2000;

// Kolonne-rækkefølge skal matche VALUES-mappingen i rowToValues().
const COLUMNS = [
  "resource",
  "category",
  "action",
  "severity",
  "message",
  "source",
  "identifier",
  "license",
  "steam",
  "discord",
  "player_name",
  "esx_name",
  "job",
  "job_grade",
  "target_identifier",
  "target_discord",
  "target_name",
  "amount",
  "item",
  "weapon",
  "plate",
  "coords",
  "metadata_json",
  "search_text",
  "log_key",
] as const;

type LogRow = Record<string, unknown>;

// Idempotent skema-opsætning. Kører kun én gang pr. Node-proces; matcher
// essential.zaki_logs men metadata_json er LONGTEXT (robust mod evt. ugyldig
// JSON) og der er ingen FK til spil-DB'en.
let schemaReady: Promise<void> | null = null;
function ensureSchema(pool: mysql.Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS zaki_logs (
            id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            created_at      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            resource        VARCHAR(64)     NOT NULL DEFAULT '',
            category        VARCHAR(64)     NOT NULL DEFAULT '',
            action          VARCHAR(128)    NOT NULL DEFAULT '',
            severity        VARCHAR(16)     NOT NULL DEFAULT 'info',
            message         VARCHAR(512)    NULL,
            source          INT UNSIGNED    NULL,
            identifier      VARCHAR(64)     NULL,
            license         VARCHAR(80)     NULL,
            steam           VARCHAR(80)     NULL,
            discord         VARCHAR(40)     NULL,
            player_name     VARCHAR(120)    NULL,
            esx_name        VARCHAR(120)    NULL,
            job             VARCHAR(64)     NULL,
            job_grade       INT             NULL,
            target_identifier VARCHAR(64)   NULL,
            target_discord    VARCHAR(40)   NULL,
            target_name       VARCHAR(120)  NULL,
            amount          BIGINT          NULL,
            item            VARCHAR(80)     NULL,
            weapon          VARCHAR(80)     NULL,
            plate           VARCHAR(16)     NULL,
            coords          VARCHAR(80)     NULL,
            metadata_json   LONGTEXT        NULL,
            search_text     TEXT            NULL,
            log_key         VARCHAR(48)     NULL,
            screenshot_url  VARCHAR(512)    NULL,
            PRIMARY KEY (id),
            KEY idx_created (created_at),
            KEY idx_log_key (log_key),
            KEY idx_resource (resource),
            KEY idx_category (category),
            KEY idx_action (action),
            KEY idx_severity (severity),
            KEY idx_identifier (identifier),
            KEY idx_discord (discord),
            KEY idx_steam (steam),
            KEY idx_license (license),
            KEY idx_job (job),
            KEY idx_plate (plate),
            KEY idx_item (item),
            KEY idx_target_id (target_identifier),
            FULLTEXT KEY ft_search (search_text)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      )
      .then(async () => {
        await pool.query(
          "ALTER TABLE zaki_logs ADD COLUMN IF NOT EXISTS log_key VARCHAR(48) NULL AFTER search_text"
        );
        await pool.query(
          "CREATE INDEX IF NOT EXISTS idx_log_key ON zaki_logs (log_key)"
        );
      })
      .then(() => undefined)
      .catch((err) => {
        // Nulstil så næste request prøver igen i stedet for at cache en fejl.
        schemaReady = null;
        throw err;
      });
  }
  return schemaReady;
}

function clampStr(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = typeof v === "string" ? v : String(v);
  return s.length > max ? s.slice(0, max) : s;
}

function toIntOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function rowToValues(r: LogRow): unknown[] {
  return [
    clampStr(r.resource, 64) ?? "",
    clampStr(r.category, 64) ?? "",
    clampStr(r.action, 128) ?? "",
    clampStr(r.severity, 16) ?? "info",
    clampStr(r.message, 512),
    toIntOrNull(r.source),
    clampStr(r.identifier, 64),
    clampStr(r.license, 80),
    clampStr(r.steam, 80),
    clampStr(r.discord, 40),
    clampStr(r.player_name, 120),
    clampStr(r.esx_name, 120),
    clampStr(r.job, 64),
    toIntOrNull(r.job_grade),
    clampStr(r.target_identifier, 64),
    clampStr(r.target_discord, 40),
    clampStr(r.target_name, 120),
    toIntOrNull(r.amount),
    clampStr(r.item, 80),
    clampStr(r.weapon, 80),
    clampStr(r.plate, 16),
    clampStr(r.coords, 80),
    // metadata_json kan komme som objekt eller streng; gem altid som streng.
    r.metadata_json == null
      ? null
      : typeof r.metadata_json === "string"
        ? r.metadata_json
        : JSON.stringify(r.metadata_json),
    clampStr(r.search_text, 8000),
    clampStr(r.log_key, 48),
  ];
}

export async function POST(req: NextRequest) {
  const expected = process.env.LOG_INGEST_TOKEN;
  if (!expected) {
    // Fail closed: uden konfigureret token afvises alt (ingen åben ingest).
    return NextResponse.json({ error: "ingest disabled" }, { status: 503 });
  }
  const token = req.headers.get("x-ingest-token");
  if (!token || token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const logs = (body as { logs?: unknown })?.logs;
  if (!Array.isArray(logs)) {
    return NextResponse.json({ error: "logs must be an array" }, { status: 400 });
  }
  if (logs.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }
  if (logs.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `batch too large (max ${MAX_BATCH})` },
      { status: 413 }
    );
  }

  const values = logs.map((l) => rowToValues((l ?? {}) as LogRow));

  try {
    const pool = getPool();
    await ensureSchema(pool);
    await pool.query(
      `INSERT INTO zaki_logs (${COLUMNS.join(",")}) VALUES ?`,
      [values]
    );
    return NextResponse.json({ ok: true, inserted: values.length });
  } catch (err) {
    console.error("[ingest/logs] DB error:", err);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
