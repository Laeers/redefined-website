import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { requireAdmin } from "@/lib/admin-guard";
import { getEsxPool } from "@/lib/esx-db";

export const dynamic = "force-dynamic";

const SORT_COLUMNS = ["name", "identifier", "job", "bank", "cash", "group"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function buildOrderClause(sort: SortColumn, dir: "ASC" | "DESC"): string {
  switch (sort) {
    case "identifier":
      return `identifier ${dir}`;
    case "job":
      return `job ${dir}, job_grade ${dir}`;
    case "bank":
      return `COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(accounts, '$.bank')) AS SIGNED), 0) ${dir}`;
    case "cash":
      return `COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(accounts, '$.money')) AS SIGNED), 0) ${dir}`;
    case "group":
      return `\`group\` ${dir}`;
    case "name":
    default:
      return `lastname ${dir}, firstname ${dir}`;
  }
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const sortParam = searchParams.get("sort") ?? "name";
  const dirParam = searchParams.get("dir") ?? "asc";
  const sort: SortColumn = SORT_COLUMNS.includes(sortParam as SortColumn)
    ? (sortParam as SortColumn)
    : "name";
  const dir: "ASC" | "DESC" = dirParam === "desc" ? "DESC" : "ASC";
  const orderBy = buildOrderClause(sort, dir);
  const limit = 50;
  const offset = (page - 1) * limit;

  const pool = getEsxPool();

  try {
    let rows: unknown[];
    let total: number;

    if (search) {
      const like = `%${search}%`;
      [rows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT identifier, firstname, lastname, dateofbirth, sex, job, job_grade, \`group\`, accounts
         FROM users
         WHERE identifier LIKE ? OR firstname LIKE ? OR lastname LIKE ?
            OR CONCAT(firstname, ' ', lastname) LIKE ?
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        [like, like, like, like, limit, offset]
      );
      const [[countRow]] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM users
         WHERE identifier LIKE ? OR firstname LIKE ? OR lastname LIKE ?
            OR CONCAT(firstname, ' ', lastname) LIKE ?`,
        [like, like, like, like]
      );
      total = Number((countRow as mysql.RowDataPacket).cnt);
    } else {
      [rows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT identifier, firstname, lastname, dateofbirth, sex, job, job_grade, \`group\`, accounts
         FROM users
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      const [[countRow]] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) AS cnt FROM users"
      );
      total = Number((countRow as mysql.RowDataPacket).cnt);
    }

    const players = (rows as mysql.RowDataPacket[]).map((r) => ({
      identifier: r.identifier,
      firstname: r.firstname ?? "",
      lastname: r.lastname ?? "",
      dateofbirth: r.dateofbirth ?? "",
      sex: r.sex ?? "",
      job: r.job ?? "unemployed",
      job_grade: r.job_grade ?? 0,
      group: r.group ?? "user",
      accounts: safeJson(r.accounts as string | null),
    }));

    return NextResponse.json({ players, total, page, limit, sort, dir: dir.toLowerCase() });
  } catch (err) {
    console.error("[admin/players] DB error:", err);
    return NextResponse.json({ error: "Database fejl" }, { status: 500 });
  }
}

function safeJson(val: string | null): Record<string, number> {
  if (!val) return {};
  try {
    return JSON.parse(val);
  } catch {
    return {};
  }
}
