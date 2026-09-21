import type { RowDataPacket } from "mysql2";
import { getPool } from "./db";
import type { Application, ApplicationStatus } from "./applications";

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

function rowToApp(r: AppRow): Application {
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

export interface ListFilters {
  status?: ApplicationStatus | "all";
  search?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
  sort?: "newest" | "oldest" | "updated";
}

export interface ListResult {
  applications: Application[];
  total: number;
  counts: Record<ApplicationStatus, number>;
}

export async function listApplications(filters: ListFilters): Promise<ListResult> {
  const pool = getPool();
  const where: string[] = [];
  const args: unknown[] = [];

  if (filters.status && filters.status !== "all") {
    where.push("status = ?");
    args.push(filters.status);
  }
  if (filters.search) {
    where.push("(username LIKE ? OR real_name LIKE ? OR char_name LIKE ? OR discord_id LIKE ?)");
    const like = `%${filters.search}%`;
    args.push(like, like, like, like);
  }
  if (filters.fromDate) {
    where.push("created_at >= ?");
    args.push(new Date(filters.fromDate));
  }
  if (filters.toDate) {
    where.push("created_at <= ?");
    args.push(new Date(filters.toDate));
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const sortSql =
    filters.sort === "oldest"
      ? "ORDER BY created_at ASC"
      : filters.sort === "updated"
        ? "ORDER BY updated_at DESC"
        : "ORDER BY created_at DESC";

  const limit = Math.min(filters.limit ?? 50, 500);
  const offset = Math.max(filters.offset ?? 0, 0);

  const [rows] = await pool.query<AppRow[]>(
    `SELECT * FROM applications ${whereSql} ${sortSql} LIMIT ${limit} OFFSET ${offset}`,
    args
  );
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM applications ${whereSql}`,
    args
  );
  const [statusRows] = await pool.query<RowDataPacket[]>(
    `SELECT status, COUNT(*) AS c FROM applications GROUP BY status`
  );

  const counts: Record<ApplicationStatus, number> = {
    pending: 0,
    awaiting_interview: 0,
    approved: 0,
    rejected: 0,
    changes_requested: 0,
  };
  for (const r of statusRows) {
    counts[r.status as ApplicationStatus] = Number(r.c);
  }

  return {
    applications: rows.map(rowToApp),
    total: Number(countRows[0].c),
    counts,
  };
}

export async function setApplicationStatus(
  discordId: string,
  status: ApplicationStatus,
  staffNote: string | null
): Promise<Application | null> {
  const pool = getPool();
  await pool.query(
    `UPDATE applications
        SET status = ?, staff_note = ?, updated_at = NOW()
      WHERE discord_id = ?`,
    [status, staffNote, discordId]
  );
  const [rows] = await pool.query<AppRow[]>(
    `SELECT * FROM applications WHERE discord_id = ? LIMIT 1`,
    [discordId]
  );
  if (!rows.length) return null;
  return rowToApp(rows[0]);
}
