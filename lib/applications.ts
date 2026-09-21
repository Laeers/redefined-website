import type { RowDataPacket } from "mysql2";
import { getPool } from "./db";
import type { Application, ApplicationStatus } from "./applications-types";

export {
  STATUS_LABEL,
  STATUS_TONE,
} from "./applications-types";
export type { Application, ApplicationStatus } from "./applications-types";

interface AppRow extends RowDataPacket {
  discord_id: string;
  username: string;
  age: string;
  steam_hours: string;
  real_name: string;
  char_name: string;
  char_backstory: string;
  rp_experience: string;
  scenario: string;
  agree: number;
  status: ApplicationStatus;
  staff_note: string | null;
  revision: number;
  created_at: Date;
  updated_at: Date;
}

function toApp(r: AppRow): Application {
  return {
    discordId: r.discord_id,
    username: r.username,
    age: r.age,
    steamHours: r.steam_hours,
    realName: r.real_name,
    charName: r.char_name,
    charBackstory: r.char_backstory,
    rpExperience: r.rp_experience,
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

export async function getApplication(
  discordId: string
): Promise<Application | null> {
  if (!isValidDiscordId(discordId)) return null;
  const pool = getPool();
  const [rows] = await pool.query<AppRow[]>(
    "SELECT * FROM applications WHERE discord_id = ? LIMIT 1",
    [discordId]
  );
  if (!rows.length) return null;
  return toApp(rows[0]);
}

export async function saveApplication(app: Application): Promise<void> {
  if (!isValidDiscordId(app.discordId)) throw new Error("invalid discord id");
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO applications
         (discord_id, username, age, steam_hours, real_name, char_name, char_backstory,
          rp_experience, scenario, agree, status, staff_note, revision,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         username = VALUES(username),
         age = VALUES(age),
         steam_hours = VALUES(steam_hours),
         real_name = VALUES(real_name),
         char_name = VALUES(char_name),
         char_backstory = VALUES(char_backstory),
         rp_experience = VALUES(rp_experience),
         scenario = VALUES(scenario),
         agree = VALUES(agree),
         status = VALUES(status),
         staff_note = VALUES(staff_note),
         revision = VALUES(revision),
         updated_at = VALUES(updated_at)`,
      [
        app.discordId,
        app.username,
        app.age,
        app.steamHours,
        app.realName,
        app.charName,
        app.charBackstory,
        app.rpExperience,
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
      `INSERT INTO application_revisions (discord_id, revision, payload, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        app.discordId,
        app.revision,
        JSON.stringify({
          age: app.age,
          steamHours: app.steamHours,
          realName: app.realName,
          charName: app.charName,
          charBackstory: app.charBackstory,
          rpExperience: app.rpExperience,
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

