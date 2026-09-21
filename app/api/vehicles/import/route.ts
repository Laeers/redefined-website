import { NextRequest, NextResponse } from "next/server";
import {
  requireVehicleEditor,
  bulkUpdate,
  type BulkUpdateInput,
} from "@/lib/vehicle-tuning";

export const dynamic = "force-dynamic";

// Minimal CSV-parser: håndterer citerede felter ("..."), "" som escaped citat,
// komma-separator og både \n og \r\n linjeskift.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  // sidste felt/række hvis filen ikke slutter på linjeskift
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // drop helt tomme rækker
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function toIntOrNull(v: string | undefined): number | null {
  if (v === undefined) return null;
  const s = v.trim();
  if (s === "" || s === "—") return null;
  const n = Math.round(Number(s.replace(/\s/g, "").replace(/\./g, "")));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// POST: importér CSV (body = rå CSV-tekst). Opdaterer kun pris + topfart, matchet på model.
export async function POST(req: NextRequest) {
  const guard = await requireVehicleEditor();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const text = await req.text();
  if (!text.trim()) {
    return NextResponse.json({ error: "Tom fil" }, { status: 400 });
  }

  const grid = parseCsv(text);
  if (grid.length < 2) {
    return NextResponse.json({ error: "CSV mangler data-rækker" }, { status: 400 });
  }

  const header = grid[0].map((h) => h.trim().toLowerCase());
  const iModel = header.indexOf("model");
  const iPrice = header.indexOf("price");
  const iKmh = header.indexOf("target_kmh");
  if (iModel === -1) {
    return NextResponse.json(
      { error: "CSV skal have en 'model'-kolonne" },
      { status: 400 }
    );
  }
  if (iPrice === -1 && iKmh === -1) {
    return NextResponse.json(
      { error: "CSV skal have mindst én af kolonnerne 'price' eller 'target_kmh'" },
      { status: 400 }
    );
  }

  const updates: BulkUpdateInput[] = [];
  const badKmh: string[] = [];
  for (const cells of grid.slice(1)) {
    const model = (cells[iModel] ?? "").trim();
    if (!model) continue;
    // undefined = kolonnen mangler → lad feltet stå urørt i DB
    const price = iPrice === -1 ? undefined : toIntOrNull(cells[iPrice]);
    const kmh = iKmh === -1 ? undefined : toIntOrNull(cells[iKmh]);
    if (kmh != null && (kmh < 30 || kmh > 500)) {
      badKmh.push(model);
      continue;
    }
    updates.push({ model, price, target_kmh: kmh });
  }

  if (updates.length === 0) {
    return NextResponse.json(
      { error: "Ingen gyldige rækker at importere" + (badKmh.length ? ` (topfart udenfor 30–500: ${badKmh.join(", ")})` : "") },
      { status: 400 }
    );
  }

  const result = await bulkUpdate(updates, guard.username ?? guard.discordId);
  return NextResponse.json({ ...result, badKmh });
}
