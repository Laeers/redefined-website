import { NextResponse } from "next/server";
import { requireKompensationViewer } from "@/lib/admin-guard";
import { getEsxPool } from "@/lib/esx-db";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

interface KompensationItem {
  name: string;
  count: number;
}

interface KompensationRow extends RowDataPacket {
  id: number;
  target_discord_id: string;
  target_discord_tag: string | null;
  target_identifier: string | null;
  items: string | object;
  reason: string | null;
  status: "pending" | "given" | "cancelled";
  created_by_discord_id: string;
  created_by_tag: string | null;
  guild_id: string | null;
  channel_id: string | null;
  channel_name: string | null;
  created_at: Date | string;
  given_at: Date | string | null;
  failure_reason: string | null;
  recipient_firstname: string | null;
  recipient_lastname: string | null;
}

function decodeItems(raw: string | object | null): KompensationItem[] {
  if (raw == null) return [];
  if (typeof raw === "object") {
    return Array.isArray(raw) ? (raw as KompensationItem[]) : [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as KompensationItem[]) : [];
  } catch {
    return [];
  }
}

function toIso(d: Date | string | null): string | null {
  if (!d) return null;
  if (typeof d === "string") return new Date(d).toISOString();
  return d.toISOString();
}

// GET /api/admin/kompensationer?status=&limit=&offset=
export async function GET(req: Request) {
  const guard = await requireKompensationViewer();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const search = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 500);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);

  const pool = getEsxPool();
  try {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (status && ["pending", "given", "cancelled"].includes(status)) {
      where.push("k.status = ?");
      params.push(status);
    }
    if (search) {
      where.push(
        "(k.target_discord_id LIKE ? OR k.target_discord_tag LIKE ? OR k.created_by_discord_id LIKE ? OR k.created_by_tag LIKE ? OR k.channel_name LIKE ? OR k.reason LIKE ? OR u.firstname LIKE ? OR u.lastname LIKE ? OR CAST(k.id AS CHAR) = ?)"
      );
      const pat = `%${search}%`;
      params.push(pat, pat, pat, pat, pat, pat, pat, pat, search);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT
        k.id, k.target_discord_id, k.target_discord_tag, k.target_identifier,
        k.items, k.reason, k.status, k.created_by_discord_id, k.created_by_tag,
        k.guild_id, k.channel_id, k.channel_name, k.created_at, k.given_at,
        k.failure_reason,
        u.firstname AS recipient_firstname, u.lastname AS recipient_lastname
      FROM kompensations k
      LEFT JOIN users u ON u.identifier = k.target_identifier
      ${whereSql}
      ORDER BY k.id DESC
      LIMIT ?
      OFFSET ?
    `;
    params.push(limit, offset);

    const [rows] = await pool.query<KompensationRow[]>(sql, params);
    const [[countRow]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM kompensations k LEFT JOIN users u ON u.identifier = k.target_identifier ${whereSql}`,
      params.slice(0, params.length - 2),
    );

    // Tæl status-fordeling for filter-counters i UI
    const [statusRows] = await pool.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) AS cnt FROM kompensations GROUP BY status`,
    );
    const statusCounts: Record<string, number> = { pending: 0, given: 0, cancelled: 0 };
    for (const r of statusRows) {
      statusCounts[r.status as string] = Number(r.cnt) || 0;
    }

    return NextResponse.json({
      total: Number(countRow.cnt) || 0,
      limit,
      offset,
      statusCounts,
      rows: rows.map((r) => ({
        id: r.id,
        targetDiscordId: r.target_discord_id,
        targetDiscordTag: r.target_discord_tag,
        targetIdentifier: r.target_identifier,
        recipientName:
          [r.recipient_firstname, r.recipient_lastname].filter(Boolean).join(" ") || null,
        items: decodeItems(r.items),
        reason: r.reason,
        status: r.status,
        createdByDiscordId: r.created_by_discord_id,
        createdByTag: r.created_by_tag,
        channelId: r.channel_id,
        channelName: r.channel_name,
        createdAt: toIso(r.created_at),
        givenAt: toIso(r.given_at),
        failureReason: r.failure_reason,
      })),
    });
  } catch (err) {
    console.error("[admin/kompensationer]", err);
    return NextResponse.json({ error: "Database fejl" }, { status: 500 });
  }
}
