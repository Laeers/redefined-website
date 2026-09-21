import { NextResponse } from "next/server";
import { listApplications } from "@/lib/applications-admin";
import { requireStaff } from "@/lib/admin-guard";
import type { ApplicationStatus } from "@/lib/applications";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireStaff();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as ApplicationStatus | "all" | null;
  const search = url.searchParams.get("q") ?? undefined;
  const fromDate = url.searchParams.get("from") ?? undefined;
  const toDate = url.searchParams.get("to") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const sort = (url.searchParams.get("sort") as "newest" | "oldest" | "updated" | null) ?? "newest";

  const result = await listApplications({
    status: status ?? "all",
    search,
    fromDate,
    toDate,
    limit,
    offset,
    sort,
  });
  return NextResponse.json(result);
}
