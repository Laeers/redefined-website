"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HANDLING_TERMS,
  HANDLING_FIELD_ORDER,
  TOP_SPEED_EXPLAINER,
} from "@/lib/handling-glossary";

type Source = "vehicleshop" | "police" | "ambulance";

type SortKey =
  | "name" | "price" | "target_kmh"
  | "speed" | "accel" | "grip" | "brake" | "overall";

// Klikbar info-tooltip: viser forklaringen for et handling-felt.
function Help({ field, label }: { field: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const t = HANDLING_TERMS[field];
  if (!t) return <>{label ?? field}</>;
  return (
    <span className="relative inline-flex items-center gap-1">
      <span>{label ?? t.label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-zinc-200 hover:bg-blue-600"
        aria-label="Forklaring"
      >
        ?
      </button>
      {open && (
        <span
          className="absolute left-0 top-6 z-20 w-64 rounded border border-zinc-600 bg-zinc-950 p-2 text-xs font-normal text-zinc-200 shadow-xl"
          onClick={() => setOpen(false)}
        >
          <span className="block font-semibold text-blue-300">
            {t.label} <span className="font-mono text-zinc-500">({t.meta})</span>
          </span>
          <span className="mt-1 block text-zinc-300">{t.explain}</span>
          {t.affectsTopSpeed && (
            <span className="mt-1 block text-amber-400">↑ Påvirkes når du ændrer topfart.</span>
          )}
        </span>
      )}
    </span>
  );
}

function fmtVal(field: string, v: number | null): string {
  if (v === null || v === undefined) return "—";
  if (field === "gears") return String(Math.round(v));
  if (field === "mass") return Math.round(v).toLocaleString("da-DK");
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

interface Row {
  model: string;
  name: string;
  source: Source;
  category: string | null;
  shop: number | null;
  price: number | null;
  target_kmh: number | null;
  flat_vel: number | null;
  drive_force: number | null;
  brake_force: number | null;
  traction_max: number | null;
  drag: number | null;
  mass: number | null;
  drive_inertia: number | null;
  gears: number | null;
  drive_bias_front: number | null;
  brake_bias_front: number | null;
  handbrake_force: number | null;
  traction_curve_min: number | null;
  traction_bias_front: number | null;
  steering_lock: number | null;
  traction_loss_mult: number | null;
  low_speed_traction_loss: number | null;
  handling_name: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

const SOURCE_LABEL: Record<Source, string> = {
  vehicleshop: "🏬 Vehicleshop",
  police: "🚓 Politi",
  ambulance: "🚑 Ambulance",
};

// buisnessID → shop-navn (fra redefined_vehicleshop/config.lua)
const SHOP_LABEL: Record<number, string> = {
  1: "Bilforhandler",
  3: "Western MC",
  5: "Import Racing",
};
const shopName = (id: number | null): string =>
  id == null ? "—" : SHOP_LABEL[id] ?? `Shop ${id}`;

// Kolonner i eksport-CSV'en (samme rækkefølge som Row). Kun model/price/target_kmh
// læses ved import — resten er snapshot/reference.
const CSV_COLUMNS: (keyof Row)[] = [
  "model", "name", "source", "shop", "category", "price", "target_kmh",
  "flat_vel", "drive_force", "brake_force", "traction_max", "drag", "mass",
  "drive_inertia", "gears", "drive_bias_front", "brake_bias_front",
  "handbrake_force", "traction_curve_min", "traction_bias_front",
  "steering_lock", "traction_loss_mult", "low_speed_traction_loss",
  "handling_name", "updated_by", "updated_at",
];

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToCsv(rows: Row[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(CSV_COLUMNS.map((c) => csvCell((r as unknown as Record<string, unknown>)[c])).join(","));
  }
  return lines.join("\r\n");
}

function kr(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("da-DK") + " kr";
}

// Relativ 0-100 normalisering på tværs af alle rækker med data.
function makeNorm(values: number[]): (v: number | null) => number | null {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length === 0) return () => null;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  return (v) => {
    if (v === null || !Number.isFinite(v)) return null;
    if (hi === lo) return 50;
    return Math.round(((v - lo) / (hi - lo)) * 100);
  };
}

export default function BilerPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const [shopFilter, setShopFilter] = useState<string>("all"); // "all" | buisnessID
  const [catFilter, setCatFilter] = useState<string>("all"); // "all" | category
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "price", dir: "asc" });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (model: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(model)) n.delete(model);
      else n.add(model);
      return n;
    });

  // apply/sync-job
  const [applyId, setApplyId] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<string | null>(null);
  const [applyOutput, setApplyOutput] = useState<string>("");
  const [jobEndpoint, setJobEndpoint] = useState<string>("/api/vehicles/apply");

  // import/eksport
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // adgang
  const [access, setAccess] = useState<{ discord_id: string; label: string | null }[]>([]);
  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/vehicles", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Fejl");
      setRows(j.rows);
      setIsOwner(!!j.isOwner);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadAccess = useCallback(async () => {
    const r = await fetch("/api/vehicles/access", { cache: "no-store" });
    if (r.ok) setAccess((await r.json()).access ?? []);
  }, []);

  useEffect(() => {
    if (isOwner) loadAccess();
  }, [isOwner, loadAccess]);

  // scorer (relativt på tværs af alle biler med handling)
  const scoreFns = useMemo(() => {
    const speed = makeNorm(
      rows.map((r) =>
        r.flat_vel && r.drag ? r.flat_vel / Math.sqrt(Math.max(r.drag, 0.5)) : NaN
      )
    );
    const accel = makeNorm(rows.map((r) => (r.drive_force ?? NaN) as number));
    const grip = makeNorm(rows.map((r) => (r.traction_max ?? NaN) as number));
    const brake = makeNorm(rows.map((r) => (r.brake_force ?? NaN) as number));
    return { speed, accel, grip, brake };
  }, [rows]);

  function rowScores(r: Row) {
    const s = scoreFns.speed(r.flat_vel && r.drag ? r.flat_vel / Math.sqrt(Math.max(r.drag, 0.5)) : null);
    const a = scoreFns.accel(r.drive_force);
    const g = scoreFns.grip(r.traction_max);
    const b = scoreFns.brake(r.brake_force);
    const overall =
      s !== null && a !== null
        ? Math.round(s * 0.3 + a * 0.3 + (g ?? 0) * 0.25 + (b ?? 0) * 0.15)
        : null;
    return { s, a, g, b, overall };
  }

  // Værdi der sorteres på for en given kolonne (null = mangler → altid sidst).
  function sortValue(r: Row, key: SortKey): number | string | null {
    switch (key) {
      case "name": return r.name?.toLowerCase() ?? "";
      case "price": return r.price;
      case "target_kmh": return r.target_kmh;
      case "speed": return rowScores(r).s;
      case "accel": return rowScores(r).a;
      case "grip": return rowScores(r).g;
      case "brake": return rowScores(r).b;
      case "overall": return rowScores(r).overall;
    }
  }

  function sortRows(rows: Row[]): Row[] {
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = sortValue(a, key);
      const vb = sortValue(b, key);
      const aNull = va === null || va === undefined;
      const bNull = vb === null || vb === undefined;
      if (aNull && bNull) return 0;
      if (aNull) return 1; // mangler-værdier altid nederst uanset retning
      if (bNull) return -1;
      if (typeof va === "string" || typeof vb === "string") {
        return String(va).localeCompare(String(vb), "da") * mul;
      }
      return ((va as number) - (vb as number)) * mul;
    });
  }

  // Klik på en kolonne: skift retning hvis samme, ellers ny nøgle med valgt default.
  function toggleSort(key: SortKey, defaultDir: "asc" | "desc" = "asc") {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir }));
  }

  const sortArrow = (key: SortKey) => (sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : "");

  const saveRow = useCallback(
    async (model: string, price: number | null, target_kmh: number | null) => {
      setSaving((m) => ({ ...m, [model]: true }));
      try {
        const r = await fetch("/api/vehicles", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, price, target_kmh }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          alert(j.error ?? "Kunne ikke gemme");
        }
      } finally {
        setSaving((m) => ({ ...m, [model]: false }));
      }
    },
    []
  );

  function patchLocal(model: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.model === model ? { ...r, ...patch } : r)));
  }

  // Valgmuligheder til dropdowns (udledt af data).
  const shopOptions = useMemo(() => {
    const ids = Array.from(new Set(rows.map((r) => r.shop).filter((s): s is number => s != null)));
    return ids.sort((a, b) => a - b);
  }, [rows]);
  const catOptions = useMemo(() => {
    const cats = Array.from(new Set(rows.map((r) => r.category).filter((c): c is string => !!c)));
    return cats.sort();
  }, [rows]);

  // Fælles filtrering (tekst + shop + type) — bruges af både tabel og eksport.
  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return rows.filter((r) => {
      if (f && !`${r.name} ${r.model} ${r.category ?? ""}`.toLowerCase().includes(f)) return false;
      if (shopFilter !== "all" && String(r.shop ?? "") !== shopFilter) return false;
      if (catFilter !== "all" && (r.category ?? "") !== catFilter) return false;
      return true;
    });
  }, [rows, filter, shopFilter, catFilter]);

  // Eksportér den aktuelt filtrerede liste (søgning + shop + type) til en CSV-fil.
  const exportCsv = useCallback(() => {
    const csv = "﻿" + rowsToCsv(filtered); // BOM så Excel læser æøå korrekt
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "biler.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  // Importér CSV: opdaterer pris + topfart (matchet på model) via API.
  const importCsv = useCallback(
    async (file: File) => {
      setImporting(true);
      try {
        const text = await file.text();
        const r = await fetch("/api/vehicles/import", {
          method: "POST",
          headers: { "Content-Type": "text/csv" },
          body: text,
        });
        const j = await r.json();
        if (!r.ok) {
          alert(j.error ?? "Import fejlede");
          return;
        }
        let msg = `Importeret: ${j.updated} bil(er) opdateret.`;
        if (j.unknown?.length) msg += `\nUkendte modeller (sprunget over): ${j.unknown.join(", ")}`;
        if (j.badKmh?.length) msg += `\nUgyldig topfart (sprunget over): ${j.badKmh.join(", ")}`;
        alert(msg);
        load();
      } catch (e) {
        alert((e as Error).message);
      } finally {
        setImporting(false);
      }
    },
    [load]
  );

  async function runJob(endpoint: string, confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    setJobEndpoint(endpoint);
    setApplyStatus("queued");
    setApplyOutput("");
    const r = await fetch(endpoint, { method: "POST" });
    const j = await r.json();
    if (!r.ok) {
      setApplyStatus(null);
      alert(j.error ?? "Job fejlede");
      return;
    }
    setApplyId(j.id);
  }
  const runApply = () =>
    runJob("/api/vehicles/apply", "Anvend dokumentet live? Claude redigerer handling-filer + priser og committer.");
  const runSync = () =>
    runJob("/api/vehicles/sync", "Genlæs configs og opdater listen (fanger nye biler)? Ændrer ikke spil-filer.");

  // poll apply-status
  useEffect(() => {
    if (!applyId) return;
    let stop = false;
    const tick = async () => {
      const r = await fetch(`${jobEndpoint}?id=${applyId}`, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setApplyStatus(j.status);
        setApplyOutput(j.output ?? "");
        if (j.status === "done" || j.status === "error") {
          stop = true;
          load();
          return;
        }
      }
      if (!stop) setTimeout(tick, 3000);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [applyId, jobEndpoint, load]);

  const grouped = useMemo(() => {
    const out: Record<Source, Row[]> = { vehicleshop: [], police: [], ambulance: [] };
    for (const r of filtered) out[r.source].push(r);
    return out;
  }, [filtered]);

  if (loading) return <div className="p-8 text-zinc-300">Indlæser bil-liste…</div>;
  if (err)
    return (
      <div className="p-8 text-red-400">
        {err === "Ingen adgang"
          ? "Du har ikke adgang til bil-listen. Bed en owner om at tilføje dit Discord-ID."
          : err}
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 text-zinc-100">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bil-tuning</h1>
          <p className="text-sm text-zinc-400">
            Rediger pris (indkøbspris) og topfart. {isOwner ? "Tryk Apply for at sætte ændringerne live." : "Kun owner kan anvende live."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            placeholder="Søg bil…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm outline-none ring-1 ring-zinc-700"
          />
          <select
            value={shopFilter}
            onChange={(e) => setShopFilter(e.target.value)}
            className="rounded bg-zinc-800 px-2 py-1.5 text-sm outline-none ring-1 ring-zinc-700"
            title="Filtrér efter shop"
          >
            <option value="all">Alle shops</option>
            {shopOptions.map((id) => (
              <option key={id} value={String(id)}>
                {shopName(id)}
              </option>
            ))}
          </select>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded bg-zinc-800 px-2 py-1.5 text-sm outline-none ring-1 ring-zinc-700"
            title="Filtrér efter køretøjstype"
          >
            <option value="all">Alle typer</option>
            {catOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {(shopFilter !== "all" || catFilter !== "all") && (
            <button
              onClick={() => {
                setShopFilter("all");
                setCatFilter("all");
              }}
              className="rounded px-2 py-1.5 text-sm text-zinc-400 hover:text-zinc-100"
              title="Ryd filtre"
            >
              ✕ ryd
            </button>
          )}
          <button
            onClick={exportCsv}
            className="rounded bg-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-600"
            title="Download listen som CSV (følger søgefilteret)"
          >
            Eksportér CSV
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="rounded bg-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-600 disabled:opacity-50"
            title="Importér CSV — opdaterer pris + topfart matchet på model"
          >
            {importing ? "Importerer…" : "Importér CSV"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f);
              e.target.value = "";
            }}
          />
          {isOwner && (
            <>
              <button
                onClick={runSync}
                disabled={applyStatus === "queued" || applyStatus === "running"}
                className="rounded bg-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-600 disabled:opacity-50"
                title="Genlæs configs og fang nye biler"
              >
                Synk fra config
              </button>
              <button
                onClick={runApply}
                disabled={applyStatus === "queued" || applyStatus === "running"}
                className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                {applyStatus === "running" || applyStatus === "queued" ? "Arbejder…" : "Apply (live)"}
              </button>
            </>
          )}
        </div>
      </div>

      <details className="mb-4 rounded border border-blue-900/60 bg-blue-950/30 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-blue-300">
          Hvad ændrer &quot;Topfart&quot; egentlig i handling?
        </summary>
        <p className="mt-2 text-zinc-300">{TOP_SPEED_EXPLAINER}</p>
        <p className="mt-1 text-zinc-400">
          Fold en bil ud (▸) for at se ALLE handling-værdier — klik på ? ved hver for en forklaring.
        </p>
      </details>

      {applyStatus && (
        <div className="mb-4 rounded border border-zinc-700 bg-zinc-900 p-3 text-sm">
          <div className="mb-1 font-semibold">
            Apply-job: <span className="text-emerald-400">{applyStatus}</span>
          </div>
          {applyOutput && (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-zinc-400">
              {applyOutput.slice(-4000)}
            </pre>
          )}
        </div>
      )}

      {isOwner && (
        <details className="mb-4 rounded border border-zinc-700 bg-zinc-900 p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Adgang (Discord-ID'er)</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              placeholder="Discord-ID"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className="rounded bg-zinc-800 px-2 py-1 ring-1 ring-zinc-700"
            />
            <input
              placeholder="Navn (valgfrit)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="rounded bg-zinc-800 px-2 py-1 ring-1 ring-zinc-700"
            />
            <button
              onClick={async () => {
                const r = await fetch("/api/vehicles/access", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ discord_id: newId, label: newLabel }),
                });
                if (r.ok) {
                  setNewId("");
                  setNewLabel("");
                  loadAccess();
                } else alert((await r.json()).error ?? "Fejl");
              }}
              className="rounded bg-blue-600 px-3 py-1 font-semibold hover:bg-blue-500"
            >
              Tilføj
            </button>
          </div>
          <ul className="mt-3 space-y-1">
            {access.map((a) => (
              <li key={a.discord_id} className="flex items-center gap-2 text-zinc-300">
                <span className="font-mono text-xs">{a.discord_id}</span>
                {a.label && <span className="text-zinc-500">({a.label})</span>}
                <button
                  onClick={async () => {
                    await fetch(`/api/vehicles/access?discord_id=${a.discord_id}`, { method: "DELETE" });
                    loadAccess();
                  }}
                  className="text-red-400 hover:underline"
                >
                  fjern
                </button>
              </li>
            ))}
            {access.length === 0 && <li className="text-zinc-500">Ingen tilføjet endnu.</li>}
          </ul>
        </details>
      )}

      {(Object.keys(SOURCE_LABEL) as Source[]).map((src) => {
        const list = sortRows(grouped[src]);
        if (list.length === 0) return null;
        return (
          <section key={src} className="mb-6">
            <h2 className="mb-2 text-lg font-semibold">
              {SOURCE_LABEL[src]} <span className="text-zinc-500">({list.length})</span>
            </h2>
            <div className="overflow-x-auto rounded border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900 text-left text-zinc-400">
                  <tr>
                    <th className="w-6 px-1 py-1.5"></th>
                    <th
                      className="cursor-pointer select-none px-2 py-1.5 hover:text-zinc-200"
                      onClick={() => toggleSort("name")}
                    >
                      Bil{sortArrow("name")}
                    </th>
                    <th className="px-2 py-1.5">Model</th>
                    {src === "vehicleshop" && (
                      <th
                        className="cursor-pointer select-none px-2 py-1.5 hover:text-zinc-200"
                        onClick={() => toggleSort("price", "desc")}
                      >
                        Indkøbspris{sortArrow("price")}
                      </th>
                    )}
                    <th
                      className="cursor-pointer select-none px-2 py-1.5 hover:text-zinc-200"
                      onClick={() => toggleSort("target_kmh", "desc")}
                    >
                      <Help field="flat_vel" label="Topfart (km/t)" />{sortArrow("target_kmh")}
                    </th>
                    <th
                      className="cursor-pointer select-none px-2 py-1.5 text-center hover:text-zinc-200"
                      onClick={() => toggleSort("speed", "desc")}
                    >
                      Fart{sortArrow("speed")}
                    </th>
                    <th
                      className="cursor-pointer select-none px-2 py-1.5 text-center hover:text-zinc-200"
                      onClick={() => toggleSort("accel", "desc")}
                    >
                      Acc{sortArrow("accel")}
                    </th>
                    <th
                      className="cursor-pointer select-none px-2 py-1.5 text-center hover:text-zinc-200"
                      onClick={() => toggleSort("grip", "desc")}
                    >
                      Greb{sortArrow("grip")}
                    </th>
                    <th
                      className="cursor-pointer select-none px-2 py-1.5 text-center hover:text-zinc-200"
                      onClick={() => toggleSort("brake", "desc")}
                    >
                      Brem{sortArrow("brake")}
                    </th>
                    <th
                      className="cursor-pointer select-none px-2 py-1.5 text-center hover:text-zinc-200"
                      onClick={() => toggleSort("overall", "desc")}
                    >
                      Total{sortArrow("overall")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => {
                    const sc = rowScores(r);
                    const noHandling = r.flat_vel === null;
                    const isOpen = expanded.has(r.model);
                    const colSpan = src === "vehicleshop" ? 10 : 9;
                    return (
                      <Fragment key={r.model}>
                      <tr className="border-t border-zinc-800 hover:bg-zinc-900/50">
                        <td className="px-1 py-1 text-center">
                          {!noHandling && (
                            <button
                              onClick={() => toggleExpand(r.model)}
                              className="text-zinc-500 hover:text-zinc-200"
                              aria-label="Vis handling-værdier"
                            >
                              {isOpen ? "▾" : "▸"}
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-1 font-medium">
                          <span>{r.name}</span>
                          <span className="ml-2 inline-flex gap-1 align-middle">
                            {r.shop != null && (
                              <span className="rounded bg-blue-900/60 px-1.5 py-0.5 text-[10px] font-normal text-blue-200">
                                {shopName(r.shop)}
                              </span>
                            )}
                            {r.category && (
                              <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] font-normal text-zinc-300">
                                {r.category}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-2 py-1 font-mono text-xs text-zinc-500">{r.model}</td>
                        {src === "vehicleshop" && (
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              value={r.price ?? ""}
                              onChange={(e) =>
                                patchLocal(r.model, {
                                  price: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              onBlur={(e) =>
                                saveRow(r.model, e.target.value === "" ? null : Number(e.target.value), r.target_kmh)
                              }
                              className="w-28 rounded bg-zinc-800 px-2 py-0.5 text-right ring-1 ring-zinc-700"
                            />
                          </td>
                        )}
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            disabled={noHandling}
                            value={r.target_kmh ?? ""}
                            onChange={(e) =>
                              patchLocal(r.model, {
                                target_kmh: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            onBlur={(e) =>
                              saveRow(r.model, r.price, e.target.value === "" ? null : Number(e.target.value))
                            }
                            className="w-20 rounded bg-zinc-800 px-2 py-0.5 text-right ring-1 ring-zinc-700 disabled:opacity-40"
                          />
                          {saving[r.model] && <span className="ml-1 text-xs text-amber-400">…</span>}
                        </td>
                        <td className="px-2 py-1 text-center text-zinc-300">{sc.s ?? "—"}</td>
                        <td className="px-2 py-1 text-center text-zinc-300">{sc.a ?? "—"}</td>
                        <td className="px-2 py-1 text-center text-zinc-300">{sc.g ?? "—"}</td>
                        <td className="px-2 py-1 text-center text-zinc-300">{sc.b ?? "—"}</td>
                        <td className="px-2 py-1 text-center font-semibold text-emerald-400">
                          {sc.overall ?? "—"}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-t border-zinc-800 bg-zinc-950/60">
                          <td colSpan={colSpan} className="px-4 py-3">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
                              {HANDLING_FIELD_ORDER.map((f) => (
                                <div key={f} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="text-zinc-400">
                                    <Help field={f} />
                                  </span>
                                  <span className="font-mono text-zinc-100">
                                    {fmtVal(f, (r as unknown as Record<string, number | null>)[f])}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {r.handling_name && (
                              <div className="mt-2 text-[11px] text-zinc-600">
                                handling: {r.handling_name}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
