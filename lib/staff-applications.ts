import type { RowDataPacket } from "mysql2";
import { getPool } from "./db";
import type {
  StaffApplication,
  StaffApplicationStatus,
  StaffApplicationType,
} from "./staff-applications-types";

export {
  STAFF_STATUS_LABEL,
  STAFF_STATUS_TONE,
  STAFF_TYPE_LABEL,
  STAFF_TYPE_DESCRIPTION,
} from "./staff-applications-types";
export type {
  StaffApplication,
  StaffApplicationStatus,
  StaffApplicationType,
} from "./staff-applications-types";

/**
 * Sørger for at staff-ansøgningstabellerne findes. Køres første gang en
 * staff-ansøgnings-funktion bruges i et process. Idempotent — gentager
 * CREATE TABLE IF NOT EXISTS hver gang serveren starter, men kun én gang
 * pr. process.
 */
let schemaReady: Promise<void> | null = null;

export function ensureStaffApplicationsSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`staff_applications\` (
        \`discord_id\`       VARCHAR(32)  NOT NULL,
        \`username\`         VARCHAR(64)  NOT NULL,
        \`application_type\` ENUM('whitelist_receiver','general_staff')
                           NOT NULL,
        \`age\`              VARCHAR(8)   NOT NULL,
        \`experience\`       TEXT         NOT NULL,
        \`motivation\`       TEXT         NOT NULL,
        \`availability\`     TEXT         NOT NULL,
        \`strengths\`        TEXT         NOT NULL,
        \`scenario\`         TEXT         NOT NULL,
        \`agree\`            TINYINT(1)   NOT NULL DEFAULT 0,
        \`status\` ENUM('pending','approved','rejected')
                           NOT NULL DEFAULT 'pending',
        \`staff_note\`       TEXT         NULL,
        \`revision\`         INT          NOT NULL DEFAULT 1,
        \`created_at\`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                   ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`discord_id\`),
        KEY \`idx_staff_status\`     (\`status\`),
        KEY \`idx_staff_type\`       (\`application_type\`),
        KEY \`idx_staff_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`staff_application_revisions\` (
        \`id\`               BIGINT       NOT NULL AUTO_INCREMENT,
        \`discord_id\`       VARCHAR(32)  NOT NULL,
        \`revision\`         INT          NOT NULL,
        \`payload\`          JSON         NOT NULL,
        \`created_at\`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_staff_rev_discord\` (\`discord_id\`),
        CONSTRAINT \`fk_staff_revisions_app\`
          FOREIGN KEY (\`discord_id\`) REFERENCES \`staff_applications\`(\`discord_id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  })().catch((e) => {
    // Hvis setup fejler, prøv igen næste gang
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}

interface StaffAppRow extends RowDataPacket {
  discord_id: string;
  username: string;
  application_type: StaffApplicationType;
  age: string;
  experience: string;
  motivation: string;
  availability: string;
  strengths: string;
  scenario: string;
  agree: number;
  status: StaffApplicationStatus;
  staff_note: string | null;
  revision: number;
  created_at: Date;
  updated_at: Date;
}

export function rowToStaffApp(r: StaffAppRow): StaffApplication {
  return {
    discordId: r.discord_id,
    username: r.username,
    applicationType: r.application_type,
    age: r.age,
    experience: r.experience,
    motivation: r.motivation,
    availability: r.availability,
    strengths: r.strengths,
    scenario: r.scenario,
    agree: Boolean(r.agree),
    status: r.status,
    staffNote: r.staff_note ?? undefined,
    revision: r.revision,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function isValidDiscordId(id: string): boolean {
  return /^\d{5,32}$/.test(id);
}

export async function getStaffApplication(
  discordId: string
): Promise<StaffApplication | null> {
  if (!isValidDiscordId(discordId)) return null;
  await ensureStaffApplicationsSchema();
  const pool = getPool();
  const [rows] = await pool.query<StaffAppRow[]>(
    "SELECT * FROM staff_applications WHERE discord_id = ? LIMIT 1",
    [discordId]
  );
  if (!rows.length) return null;
  return rowToStaffApp(rows[0]);
}

export async function saveStaffApplication(app: StaffApplication): Promise<void> {
  if (!isValidDiscordId(app.discordId)) throw new Error("invalid discord id");
  await ensureStaffApplicationsSchema();
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO staff_applications
         (discord_id, username, application_type, age, experience, motivation,
          availability, strengths, scenario, agree, status, staff_note, revision,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         username = VALUES(username),
         application_type = VALUES(application_type),
         age = VALUES(age),
         experience = VALUES(experience),
         motivation = VALUES(motivation),
         availability = VALUES(availability),
         strengths = VALUES(strengths),
         scenario = VALUES(scenario),
         agree = VALUES(agree),
         status = VALUES(status),
         staff_note = VALUES(staff_note),
         revision = VALUES(revision),
         updated_at = VALUES(updated_at)`,
      [
        app.discordId,
        app.username,
        app.applicationType,
        app.age,
        app.experience,
        app.motivation,
        app.availability,
        app.strengths,
        app.scenario,
        app.agree ? 1 : 0,
        app.status,
        app.staffNote ?? null,
        app.revision,
        new Date(app.createdAt),
        new Date(app.updatedAt),
      ]
    );
    await conn.query(
      `INSERT INTO staff_application_revisions (discord_id, revision, payload, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        app.discordId,
        app.revision,
        JSON.stringify({
          applicationType: app.applicationType,
          age: app.age,
          experience: app.experience,
          motivation: app.motivation,
          availability: app.availability,
          strengths: app.strengths,
          scenario: app.scenario,
          agree: app.agree,
          status: app.status,
        }),
        new Date(app.updatedAt),
      ]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
