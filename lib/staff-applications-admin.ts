import type { RowDataPacket } from "mysql2";
import { getPool } from "./db";
import {
  ensureStaffApplicationsSchema,
  rowToStaffApp,
} from "./staff-applications";
import type {
  StaffApplication,
  StaffApplicationStatus,
  StaffApplicationType,
} from "./staff-applications-types";

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

export interface ListStaffFilters {
  status?: StaffApplicationStatus | "all";
  type?: StaffApplicationType | "all";
  search?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
  sort?: "newest" | "oldest" | "updated";
  allowedTypes?: StaffApplicationType[] | null;
}

export interface ListStaffResult {
  applications: StaffApplication[];
  total: number;
  counts: Record<StaffApplicationStatus, number>;
  typeCounts: Record<StaffApplicationType, number>;
}

export async function listStaffApplications(
  filters: ListStaffFilters
): Promise<ListStaffResult> {
  await ensureStaffApplicationsSchema();
  const pool = getPool();
  const where: string[] = [];
  const args: unknown[] = [];

  if (filters.status && filters.status !== "all") {
    where.push("status = ?");
    args.push(filters.status);
  }
  if (filters.type && filters.type !== "all") {
    where.push("application_type = ?");
    args.push(filters.type);
  } else if (filters.allowedTypes !== null && filters.allowedTypes !== undefined && filters.allowedTypes.length > 0) {
    where.push(`application_type IN (${filters.allowedTypes.map(() => "?").join(",")})`);
    args.push(...filters.allowedTypes);
  }
  if (filters.search) {
    where.push("(username LIKE ? OR discord_id LIKE ?)");
    const like = `%${filters.search}%`;
    args.push(like, like);
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

  const [rows] = await pool.query<StaffAppRow[]>(
    `SELECT * FROM staff_applications ${whereSql} ${sortSql} LIMIT ${limit} OFFSET ${offset}`,
    args
  );
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM staff_applications ${whereSql}`,
    args
  );
  const [statusRows] = await pool.query<RowDataPacket[]>(
    `SELECT status, COUNT(*) AS c FROM staff_applications GROUP BY status`
  );
  const [typeRows] = await pool.query<RowDataPacket[]>(
    `SELECT application_type, COUNT(*) AS c FROM staff_applications GROUP BY application_type`
  );

  const counts: Record<StaffApplicationStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
  };
  for (const r of statusRows) {
    counts[r.status as StaffApplicationStatus] = Number(r.c);
  }
  const typeCounts: Record<StaffApplicationType, number> = {
    whitelist_receiver: 0,
    general_staff: 0,
  };
  for (const r of typeRows) {
    typeCounts[r.application_type as StaffApplicationType] = Number(r.c);
  }

  return {
    applications: rows.map(rowToStaffApp),
    total: Number(countRows[0].c),
    counts,
    typeCounts,
  };
}

export async function setStaffApplicationStatus(
  discordId: string,
  status: StaffApplicationStatus,
  staffNote: string | null
): Promise<StaffApplication | null> {
  await ensureStaffApplicationsSchema();
  const pool = getPool();
  await pool.query(
    `UPDATE staff_applications
        SET status = ?, staff_note = ?, updated_at = NOW()
      WHERE discord_id = ?`,
    [status, staffNote, discordId]
  );
  const [rows] = await pool.query<StaffAppRow[]>(
    `SELECT * FROM staff_applications WHERE discord_id = ? LIMIT 1`,
    [discordId]
  );
  if (!rows.length) return null;
  return rowToStaffApp(rows[0]);
}
