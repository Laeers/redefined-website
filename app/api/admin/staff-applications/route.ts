import { NextResponse } from "next/server";
import { listStaffApplications } from "@/lib/staff-applications-admin";
import { requireStaffAppReader } from "@/lib/admin-guard";
import type {
  StaffApplicationStatus,
  StaffApplicationType,
} from "@/lib/staff-applications-types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireStaffAppReader();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as
    | StaffApplicationStatus
    | "all"
    | null;
  const type = url.searchParams.get("type") as
    | StaffApplicationType
    | "all"
    | null;
  const search = url.searchParams.get("q") ?? undefined;
  const fromDate = url.searchParams.get("from") ?? undefined;
  const toDate = url.searchParams.get("to") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const sort =
    (url.searchParams.get("sort") as "newest" | "oldest" | "updated" | null) ??
    "newest";

  const allowed = guard.allowedTypes;
  let effectiveType = type ?? "all";
  if (allowed !== null) {
    if (effectiveType === "all" || !effectiveType) {
      effectiveType = allowed.length === 1 ? allowed[0] : "all";
    } else if (!allowed.includes(effectiveType as StaffApplicationType)) {
      return NextResponse.json({ error: "Ingen adgang til denne type" }, { status: 403 });
    }
  }

  const result = await listStaffApplications({
    status: status ?? "all",
    type: effectiveType,
    search,
    fromDate,
    toDate,
    limit,
    offset,
    sort,
    allowedTypes: allowed,
  });
  return NextResponse.json(result);
}
