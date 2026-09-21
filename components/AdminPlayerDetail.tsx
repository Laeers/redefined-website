"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface OxItem {
  name: string;
  count: number;
  slot: number;
  metadata?: Record<string, unknown>;
}
interface Vehicle {
  plate: string;
  vehicle: Record<string, unknown> | null;
  stored: boolean;
  job: string | null;
  trunk: OxItem[];
  glovebox: OxItem[];
}
interface HouseKey {
  identifier: string;
  name: string | null;
}
interface House {
  id: number;
  price: number;
  shell: string | null;
  inventory: OxItem[];
  inventoryUpdated: string | null;
  lastActive: number | null;
  keys: HouseKey[];
}
interface Stash {
  name: string;
  items: OxItem[];
  lastupdated: string | null;
}
interface PlayerData {
  user: {
    identifier: string;
    firstname: string;
    lastname: string;
    dateofbirth: string;
    sex: string;
    job: string;
    job_grade: number;
    group: string;
    ssn: string;
    accounts: Record<string, number> | null;
    inventory: OxItem[];
    metadata: unknown;
  };
  vehicles: Vehicle[];
  housing: House[];
  stashes: Stash[];
  licenses: { type: string; label: string }[];
  permissions?: { canManageInventory?: boolean; canWipePlayer?: boolean };
}

type Tab = "oversigt" | "inventar" | "koeretoejer" | "bolig" | "licenser";

type InventoryTarget =
  | "player"
  | "vehicle_trunk"
  | "vehicle_glovebox"
  | "stash"
  | "house";

interface InventoryRemoveRequest {
  target: InventoryTarget;
  plate?: string;
  stashName?: string;
  houseId?: number;
}

interface ItemTableProps {
  canRemove?: boolean;
  removeKeyPrefix?: string;
  removingKey?: string | null;
  onRemove?: (slot: number, itemLabel: string) => void;
}

function num(n: number) {
  return n.toLocaleString("da-DK");
}
function kr(n: number) {
  return n.toLocaleString("da-DK") + " kr.";
}

// ─── Item image with fallback ───────────────────────────────────────────────
// Filenavne på disk er som regel lowercase, men nogle (WEAPON_*) findes også
// med exact case. Vi prøver:
//   1) navn som det står (matcher fx WEAPON_PISTOL.png hvis den findes)
//   2) lowercase (matcher fx weapon_pistol.png eller weapon_petrolcan.png)
// Først når begge fejler viser vi placeholder.
function itemImageCandidates(name: string): string[] {
  const lower = name.toLowerCase();
  return lower === name ? [`/items/${name}.png`] : [`/items/${name}.png`, `/items/${lower}.png`];
}

function ItemImg({ name, size = 32 }: { name: string; size?: number }) {
  const candidates = itemImageCandidates(name);
  const [idx, setIdx] = useState(0);
  const exhausted = idx >= candidates.length;

  if (exhausted) {
    return (
      <div
        className="flex shrink-0 items-center justify-center border border-[var(--line)] bg-[var(--bg-2)]"
        style={{ width: size, height: size }}
      >
        <span className="font-mono text-[8px] uppercase text-foreground-faint">?</span>
      </div>
    );
  }
  return (
    <div
      className="relative shrink-0 overflow-hidden bg-[var(--bg-2)]"
      style={{ width: size, height: size }}
    >
      <Image
        key={candidates[idx]}
        src={candidates[idx]}
        alt={name}
        fill
        className="object-contain p-0.5"
        onError={() => setIdx((i) => i + 1)}
        unoptimized
      />
    </div>
  );
}

// ─── Item table ───────────────────────────────────────────────────────────

function ItemTable({
  items,
  labels,
  canRemove,
  removeKeyPrefix,
  removingKey,
  onRemove,
}: {
  items: OxItem[];
  labels: Record<string, string>;
} & ItemTableProps) {
  if (!items || items.length === 0) {
    return (
      <p className="border border-[var(--line)] py-6 text-center text-[12.5px] text-foreground-muted">
        Tom
      </p>
    );
  }
  // Sorter i slot-rækkefølge (matcher in-game inventory).
  // Virtuelle items (money/ammo) har ofte slot 0/null - dem putter vi øverst.
  const sorted = [...items].sort((a, b) => {
    const sa = a.slot ?? 0;
    const sb = b.slot ?? 0;
    if (sa !== sb) return sa - sb;
    return b.count - a.count;
  });
  return (
    <div className="overflow-hidden rounded border border-[var(--line)]">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--line)] bg-[var(--bg-2)] text-left">
            <th className="hidden w-10 px-2 py-1.5 text-right font-mono text-[10px] font-normal uppercase tracking-wider text-foreground-faint sm:table-cell">
              #
            </th>
            <th className="w-12 px-3 py-1.5 font-mono text-[10px] font-normal uppercase tracking-wider text-foreground-faint" />
            <th className="px-3 py-1.5 font-mono text-[10px] font-normal uppercase tracking-wider text-foreground-faint">
              Item
            </th>
            <th className="px-3 py-1.5 text-right font-mono text-[10px] font-normal uppercase tracking-wider text-foreground-faint">
              Antal
            </th>
            {canRemove && <th className="w-10 px-2 py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, i) => {
            const label = labels[item.name] ?? item.name;
            const showInternalName = label.toLowerCase() !== item.name.toLowerCase();
            const slotLabel =
              item.slot && item.slot > 0
                ? String(item.slot)
                : <span className="text-foreground-faint">·</span>;
            const busy =
              removeKeyPrefix != null &&
              removingKey === `${removeKeyPrefix}:${item.slot}`;
            return (
              <tr
                key={`${item.name}-${item.slot ?? i}`}
                className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-2)]"
              >
                <td className="hidden px-2 py-1.5 text-right font-mono text-[10.5px] tabular-nums text-foreground-faint sm:table-cell">
                  {slotLabel}
                </td>
                <td className="py-1.5 pl-3">
                  <ItemImg name={item.name} size={28} />
                </td>
                <td className="px-3 py-1.5 text-foreground">
                  <div className="leading-snug">{label}</div>
                  {showInternalName && (
                    <div className="font-mono text-[10.5px] leading-snug text-foreground-faint">
                      {item.name}
                    </div>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-[12.5px] font-medium tabular-nums text-foreground">
                  {num(item.count)}
                </td>
                {canRemove && (
                  <td className="px-2 py-1.5 text-right">
                    {item.slot > 0 && onRemove && (
                      <button
                        type="button"
                        title={`Fjern ${label}`}
                        disabled={busy || (removingKey != null && !busy)}
                        onClick={() => onRemove(item.slot, label)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-900/40 text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy ? "…" : "×"}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Vehicle row ───────────────────────────────────────────────────────────

function VehicleRow({
  v,
  labels,
  itemTableProps,
  onRemoveTrunk,
  onRemoveGlovebox,
  canRemoveVehicle,
  removingVehicle,
  onRemoveVehicle,
}: {
  v: Vehicle;
  labels: Record<string, string>;
  itemTableProps: Pick<ItemTableProps, "canRemove" | "removingKey">;
  onRemoveTrunk: (slot: number, label: string) => void;
  onRemoveGlovebox: (slot: number, label: string) => void;
  canRemoveVehicle: boolean;
  removingVehicle: boolean;
  onRemoveVehicle: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const model = String(v.vehicle?.model ?? v.vehicle?.name ?? "ukendt");
  const trunkCount = v.trunk?.length ?? 0;
  const gloveboxCount = v.glovebox?.length ?? 0;
  const totalItems = trunkCount + gloveboxCount;

  return (
    <>
      <tr
        onClick={() => totalItems > 0 && setOpen(!open)}
        className={`border-b border-[var(--line)] hover:bg-[var(--bg-2)] ${totalItems > 0 ? "cursor-pointer" : ""}`}
      >
        <td className="px-4 py-2.5 font-mono text-[12.5px] tracking-wider text-foreground">
          {v.plate}
        </td>
        <td className="px-4 py-2.5 text-foreground-secondary">{model}</td>
        <td className="px-4 py-2.5 text-foreground-muted">{v.job ?? "–"}</td>
        <td className="px-4 py-2.5 text-center">
          <span
            className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
              v.stored
                ? "bg-[var(--bg-2)] text-foreground-faint"
                : "bg-emerald-900/40 text-emerald-400"
            }`}
          >
            {v.stored ? "parkeret" : "i spil"}
          </span>
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-[12px] tabular-nums text-foreground-secondary">
          {totalItems > 0 ? num(totalItems) : "–"}
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-[10px] text-foreground-faint">
          {totalItems > 0 ? (open ? "▲" : "▼") : ""}
        </td>
        {canRemoveVehicle && (
          <td className="px-2 py-2.5 text-right">
            <button
              type="button"
              title={`Fjern køretøj ${v.plate}`}
              disabled={removingVehicle}
              onClick={(e) => {
                e.stopPropagation();
                onRemoveVehicle(model);
              }}
              className="rounded border border-red-900/60 bg-red-950/40 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-red-300 hover:bg-red-900/50 disabled:opacity-50"
            >
              {removingVehicle ? "…" : "Fjern"}
            </button>
          </td>
        )}
      </tr>
      {open && (
        <tr>
          <td colSpan={canRemoveVehicle ? 7 : 6} className="bg-[var(--bg-2)] px-4 py-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {trunkCount > 0 && (
                <div>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
                    Kuffert · {trunkCount}
                  </p>
                  <ItemTable
                    items={v.trunk}
                    labels={labels}
                    {...itemTableProps}
                    removeKeyPrefix={`vehicle_trunk:${v.plate}`}
                    onRemove={onRemoveTrunk}
                  />
                </div>
              )}
              {gloveboxCount > 0 && (
                <div>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
                    Handskerum · {gloveboxCount}
                  </p>
                  <ItemTable
                    items={v.glovebox}
                    labels={labels}
                    {...itemTableProps}
                    removeKeyPrefix={`vehicle_glovebox:${v.plate}`}
                    onRemove={onRemoveGlovebox}
                  />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

export default function AdminPlayerDetail({ identifier }: { identifier: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("oversigt");
  const [data, setData] = useState<PlayerData | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removingVehicle, setRemovingVehicle] = useState<string | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState("");
  const [wiping, setWiping] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [wipeDone, setWipeDone] = useState(false);

  const removeKeyFor = useCallback((req: InventoryRemoveRequest, slot: number) => {
    if (req.target === "player") return `player:${slot}`;
    if (req.target === "vehicle_trunk" || req.target === "vehicle_glovebox") {
      return `${req.target}:${req.plate}:${slot}`;
    }
    if (req.target === "stash") return `stash:${req.stashName}:${slot}`;
    if (req.target === "house") return `house:${req.houseId}:${slot}`;
    return `unknown:${slot}`;
  }, []);

  const locationLabelFor = useCallback((req: InventoryRemoveRequest) => {
    switch (req.target) {
      case "player":
        return "inventaret";
      case "vehicle_trunk":
        return `kufferten på ${req.plate}`;
      case "vehicle_glovebox":
        return `handskerummet på ${req.plate}`;
      case "stash":
        return `stash ${req.stashName}`;
      case "house":
        return `boliglager #${req.houseId}`;
      default:
        return "lageret";
    }
  }, []);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/players/${encodeURIComponent(identifier)}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    setData(json);
  }, [identifier]);

  useEffect(() => {
    fetch("/items.json")
      .then((r) => r.json())
      .then(setLabels)
      .catch(() => {});
    reload()
      .catch((e) => setError(e instanceof Error ? e.message : "Fejl"))
      .finally(() => setLoading(false));
  }, [identifier, reload]);

  const canManageInventory = Boolean(data?.permissions?.canManageInventory);
  const canWipePlayer = Boolean(data?.permissions?.canWipePlayer);

  const handleWipe = useCallback(async () => {
    if (!canWipePlayer || wiping) return;
    if (wipeConfirm.trim() !== identifier) {
      setWipeError("Du skal skrive spillerens identifier præcist for at bekræfte.");
      return;
    }
    setWipeError(null);
    setWiping(true);
    try {
      const res = await fetch(
        `/api/admin/players/${encodeURIComponent(identifier)}/wipe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: wipeConfirm.trim() }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Wipe mislykkedes");
      setWipeDone(true);
      setTimeout(() => router.push("/admin/players"), 1500);
    } catch (e) {
      setWipeError(e instanceof Error ? e.message : "Fejl ved wipe");
      setWiping(false);
    }
  }, [canWipePlayer, wiping, wipeConfirm, identifier, router]);

  const handleRemoveItem = useCallback(
    async (req: InventoryRemoveRequest, slot: number, itemLabel: string) => {
      if (!canManageInventory) return;
      const where = locationLabelFor(req);
      if (!window.confirm(`Fjern "${itemLabel}" fra ${where}?`)) return;

      setRemoveError(null);
      setRemovingKey(removeKeyFor(req, slot));
      try {
        const res = await fetch(
          `/api/admin/players/${encodeURIComponent(identifier)}/inventory`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...req, slot }),
          }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Kunne ikke fjerne item");

        setData((prev) => {
          if (!prev) return prev;
          switch (json.target as InventoryTarget) {
            case "player":
              return {
                ...prev,
                user: { ...prev.user, inventory: json.inventory ?? prev.user.inventory },
              };
            case "vehicle_trunk":
              return {
                ...prev,
                vehicles: prev.vehicles.map((v) =>
                  v.plate === json.plate ? { ...v, trunk: json.inventory ?? [] } : v
                ),
              };
            case "vehicle_glovebox":
              return {
                ...prev,
                vehicles: prev.vehicles.map((v) =>
                  v.plate === json.plate ? { ...v, glovebox: json.inventory ?? [] } : v
                ),
              };
            case "stash":
              return {
                ...prev,
                stashes: prev.stashes.map((s) =>
                  s.name === json.stashName ? { ...s, items: json.inventory ?? [] } : s
                ),
              };
            case "house":
              return {
                ...prev,
                housing: prev.housing.map((h) =>
                  h.id === json.houseId ? { ...h, inventory: json.inventory ?? [] } : h
                ),
              };
            default:
              return prev;
          }
        });
      } catch (e) {
        setRemoveError(e instanceof Error ? e.message : "Fejl ved fjernelse");
      } finally {
        setRemovingKey(null);
      }
    },
    [canManageInventory, identifier, locationLabelFor, removeKeyFor]
  );

  const handleRemoveVehicle = useCallback(
    async (plate: string, model: string) => {
      if (!canManageInventory || removingVehicle) return;
      if (
        !window.confirm(
          `Fjern køretøjet ${plate} (${model}) permanent fra spilleren? Dette kan ikke fortrydes.`
        )
      )
        return;

      setRemoveError(null);
      setRemovingVehicle(plate);
      try {
        const res = await fetch(
          `/api/admin/players/${encodeURIComponent(identifier)}/vehicle`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plate }),
          }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Kunne ikke fjerne køretøj");

        setData((prev) =>
          prev
            ? { ...prev, vehicles: prev.vehicles.filter((v) => v.plate !== json.plate) }
            : prev
        );
      } catch (e) {
        setRemoveError(e instanceof Error ? e.message : "Fejl ved fjernelse af køretøj");
      } finally {
        setRemovingVehicle(null);
      }
    },
    [canManageInventory, removingVehicle, identifier]
  );

  const itemTableBase: Pick<ItemTableProps, "canRemove" | "removingKey"> = {
    canRemove: canManageInventory,
    removingKey,
  };

  const playerItemTableProps: ItemTableProps = {
    ...itemTableBase,
    removeKeyPrefix: "player",
    onRemove: (slot, label) => handleRemoveItem({ target: "player" }, slot, label),
  };

  if (loading)
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 pt-28 text-center text-foreground-muted">
        Henter spiller…
      </div>
    );
  if (error || !data)
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 pt-28">
        <div className="rounded border border-red-900/50 bg-red-950/20 px-4 py-3 text-red-400">
          {error ?? "Spiller ikke fundet"}
        </div>
        <Link
          href="/admin/players"
          className="mt-4 inline-block font-mono text-[12px] text-brand-400 hover:text-brand-300"
        >
          ← tilbage
        </Link>
      </div>
    );

  const { user, vehicles, housing, stashes, licenses } = data;
  const fullName = [user.firstname, user.lastname].filter(Boolean).join(" ") || identifier;
  const totalInv = user.inventory?.length ?? 0;
  const totalStashItems = stashes.reduce((s, x) => s + x.items.length, 0);

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: "oversigt", label: "Oversigt" },
    { key: "inventar", label: "Inventar", badge: totalInv + totalStashItems },
    { key: "koeretoejer", label: "Køretøjer", badge: vehicles.length },
    { key: "bolig", label: "Bolig", badge: housing.length },
    { key: "licenser", label: "Licenser", badge: licenses.length },
  ];

  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 font-mono text-[11px] text-foreground-faint">
          <Link href="/admin/players" className="hover:text-foreground">
            admin
          </Link>
          <span>/</span>
          <Link href="/admin/players" className="hover:text-foreground">
            spillere
          </Link>
          <span>/</span>
          <span className="text-foreground-muted">{user.identifier}</span>
        </div>

        {/* Header */}
        <div className="mb-6 border-b border-[var(--line)] pb-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
                Spiller
              </p>
              <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
                {fullName}
              </h1>
              <p className="mt-1 font-mono text-[11.5px] text-foreground-muted">
                {user.identifier}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {user.dateofbirth && <Tag>{user.dateofbirth}</Tag>}
              {user.sex && (
                <Tag>{user.sex === "m" ? "Mand" : user.sex === "f" ? "Kvinde" : user.sex}</Tag>
              )}
              {user.ssn && <Tag mono>SSN {user.ssn}</Tag>}
              <GroupTag group={user.group} />
              {canWipePlayer && (
                <button
                  type="button"
                  onClick={() => {
                    setWipeConfirm("");
                    setWipeError(null);
                    setWipeOpen(true);
                  }}
                  className="ml-1 inline-flex items-center gap-1.5 rounded border border-red-800/60 bg-red-950/30 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-red-300 transition-colors hover:border-red-600 hover:bg-red-900/40"
                >
                  Wipe spiller
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Accounts strip */}
        {user.accounts && Object.keys(user.accounts).length > 0 && (
          <div
            className="mb-6 grid divide-x divide-[var(--line)] border border-[var(--line)]"
            style={{
              gridTemplateColumns: `repeat(${Object.keys(user.accounts).length + 1}, 1fr)`,
            }}
          >
            <div className="px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
                Job
              </p>
              <p className="mt-1 text-[13px] text-foreground">{user.job}</p>
              <p className="font-mono text-[10.5px] text-foreground-faint">
                grade {user.job_grade}
              </p>
            </div>
            {Object.entries(user.accounts).map(([k, v]) => (
              <div key={k} className="px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
                  {k.replace("_", " ")}
                </p>
                <p className="mt-1 font-mono text-[14px] tabular-nums text-foreground">{kr(v)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-px overflow-x-auto border-b border-[var(--line)]">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2 text-[13px] transition-colors ${
                tab === t.key
                  ? "border-b border-brand-500 text-foreground"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="rounded bg-[var(--bg-2)] px-1.5 py-0.5 font-mono text-[10px] text-foreground-faint">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {removeError && (
          <div className="mb-4 rounded border border-red-900/50 bg-red-950/20 px-4 py-2 text-[13px] text-red-400">
            {removeError}
          </div>
        )}

        {tab === "oversigt" && (
          <Oversigt
            user={user}
            stats={{ vehicles: vehicles.length, houses: housing.length, items: totalInv }}
            labels={labels}
            itemTableProps={playerItemTableProps}
          />
        )}
        {tab === "inventar" && (
          <div className="space-y-6">
            {canManageInventory && (
              <p className="font-mono text-[11px] text-foreground-faint">
                Klik × for at fjerne items fra inventar, stashes og lagre. Spilleren skal
                reconnecte hvis de er online.
              </p>
            )}
            <div>
              <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
                Spiller-inventar · {totalInv}
              </p>
              <ItemTable items={user.inventory} labels={labels} {...playerItemTableProps} />
            </div>
            {stashes
              .filter((s) => s.items.length > 0)
              .map((s) => (
                <div key={s.name}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
                      Stash · {s.name} · {s.items.length}
                    </p>
                    {s.lastupdated && (
                      <p className="font-mono text-[10.5px] text-foreground-faint">
                        {new Date(s.lastupdated).toLocaleString("da-DK")}
                      </p>
                    )}
                  </div>
                  <ItemTable
                    items={s.items}
                    labels={labels}
                    {...itemTableBase}
                    removeKeyPrefix={`stash:${s.name}`}
                    onRemove={(slot, label) =>
                      handleRemoveItem({ target: "stash", stashName: s.name }, slot, label)
                    }
                  />
                </div>
              ))}
          </div>
        )}

        {tab === "koeretoejer" && (
          <div>
            {canManageInventory && vehicles.some((v) => (v.trunk?.length ?? 0) + (v.glovebox?.length ?? 0) > 0) && (
              <p className="mb-4 font-mono text-[11px] text-foreground-faint">
                Åbn køretøj for kuffert/handskerum — klik × for at fjerne items.
              </p>
            )}
            {vehicles.length === 0 ? (
              <p className="border border-[var(--line)] py-10 text-center text-[12.5px] text-foreground-muted">
                Ingen registrerede køretøjer.
              </p>
            ) : (
              <div className="border border-[var(--line)]">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--bg-2)] text-left">
                      <Th>Plade</Th>
                      <Th>Model</Th>
                      <Th>Job</Th>
                      <Th className="text-center">Status</Th>
                      <Th className="text-right">Items</Th>
                      <Th className="w-10" />
                      {canManageInventory && <Th className="w-16" />}
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v) => (
                      <VehicleRow
                        key={v.plate}
                        v={v}
                        labels={labels}
                        itemTableProps={itemTableBase}
                        onRemoveTrunk={(slot, label) =>
                          handleRemoveItem(
                            { target: "vehicle_trunk", plate: v.plate },
                            slot,
                            label
                          )
                        }
                        onRemoveGlovebox={(slot, label) =>
                          handleRemoveItem(
                            { target: "vehicle_glovebox", plate: v.plate },
                            slot,
                            label
                          )
                        }
                        canRemoveVehicle={canManageInventory}
                        removingVehicle={removingVehicle === v.plate}
                        onRemoveVehicle={(model) => handleRemoveVehicle(v.plate, model)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "bolig" && (
          <div className="space-y-3">
            {housing.length === 0 ? (
              <p className="border border-[var(--line)] py-10 text-center text-[12.5px] text-foreground-muted">
                Ingen registrerede boliger.
              </p>
            ) : (
              housing.map((h) => (
                <HouseRow
                  key={h.id}
                  h={h}
                  labels={labels}
                  itemTableProps={itemTableBase}
                  onRemoveItem={(slot, label) =>
                    handleRemoveItem({ target: "house", houseId: h.id }, slot, label)
                  }
                />
              ))
            )}
          </div>
        )}

        {tab === "licenser" && (
          <div>
            {licenses.length === 0 ? (
              <p className="border border-[var(--line)] py-10 text-center text-[12.5px] text-foreground-muted">
                Ingen licenser.
              </p>
            ) : (
              <div className="border border-[var(--line)]">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--bg-2)] text-left">
                      <Th>Type</Th>
                      <Th>Label</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenses.map((l) => (
                      <tr
                        key={l.type}
                        className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-2)]"
                      >
                        <td className="px-4 py-2 font-mono text-[11.5px] text-foreground-muted">
                          {l.type}
                        </td>
                        <td className="px-4 py-2 text-foreground">{l.label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {wipeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-red-900/60 bg-[var(--bg-1)] p-6 shadow-2xl">
            {wipeDone ? (
              <div className="text-center">
                <p className="text-[15px] font-semibold text-red-400">Spiller wipet</p>
                <p className="mt-2 text-[13px] text-foreground-muted">
                  Sender dig tilbage til spillerlisten…
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-[16px] font-semibold text-red-400">Wipe spiller permanent</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-foreground-muted">
                  Dette sletter <span className="text-foreground">{fullName}</span> fuldstændigt:
                  brugeren, alle køretøjer, frigiver boliger, og fjerner stashes og licenser.
                  <span className="mt-1 block font-semibold text-red-300">
                    Handlingen kan ikke fortrydes.
                  </span>
                </p>
                <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-foreground-faint">
                  Skriv spillerens identifier for at bekræfte
                </p>
                <p className="mt-1 select-all break-all font-mono text-[11.5px] text-foreground-secondary">
                  {identifier}
                </p>
                <input
                  type="text"
                  value={wipeConfirm}
                  onChange={(e) => setWipeConfirm(e.target.value)}
                  placeholder="identifier…"
                  autoFocus
                  className="mt-2 w-full rounded border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 font-mono text-[12.5px] text-foreground outline-none focus:border-red-600"
                />
                {wipeError && (
                  <p className="mt-2 text-[12.5px] text-red-400">{wipeError}</p>
                )}
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setWipeOpen(false)}
                    disabled={wiping}
                    className="rounded border border-[var(--line)] px-3 py-1.5 text-[13px] text-foreground-muted transition-colors hover:bg-[var(--bg-2)] disabled:opacity-40"
                  >
                    Annullér
                  </button>
                  <button
                    type="button"
                    onClick={handleWipe}
                    disabled={wiping || wipeConfirm.trim() !== identifier}
                    className="rounded border border-red-700 bg-red-900/50 px-3 py-1.5 text-[13px] font-medium text-red-200 transition-colors hover:bg-red-800/60 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {wiping ? "Wiper…" : "Wipe permanent"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── House row (dropdown) ──────────────────────────────────────────────────

function HouseRow({
  h,
  labels,
  itemTableProps,
  onRemoveItem,
}: {
  h: House;
  labels: Record<string, string>;
  itemTableProps: Pick<ItemTableProps, "canRemove" | "removingKey">;
  onRemoveItem: (slot: number, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const itemCount = h.inventory?.length ?? 0;
  const keyCount = h.keys?.length ?? 0;
  const hasContent = itemCount > 0 || keyCount > 0;

  return (
    <div className="border border-[var(--line)]">
      <button
        type="button"
        onClick={() => hasContent && setOpen((v) => !v)}
        className={`flex w-full items-center justify-between border-b border-[var(--line)] bg-[var(--bg-2)] px-4 py-2.5 text-left ${
          hasContent ? "cursor-pointer hover:bg-[var(--bg-3)]" : "cursor-default"
        } ${open ? "" : "border-b-0"}`}
      >
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-mono text-[12px] text-foreground-secondary">#{h.id}</span>
          {h.shell && (
            <span className="font-mono text-[11.5px] text-foreground-muted">{h.shell}</span>
          )}
          <span className="font-mono text-[10.5px] text-foreground-faint">
            {itemCount > 0 ? `${itemCount} items` : "tomt lager"}
            {keyCount > 0 && ` · ${keyCount} nøgle${keyCount === 1 ? "" : "r"}`}
          </span>
        </div>
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-[12px] tabular-nums text-foreground-secondary">
            {kr(h.price)}
          </span>
          {h.lastActive && (
            <span className="font-mono text-[10.5px] text-foreground-faint">
              {new Date(h.lastActive * 1000).toLocaleDateString("da-DK")}
            </span>
          )}
          {hasContent && (
            <span className="font-mono text-[10px] text-foreground-faint">
              {open ? "▲" : "▼"}
            </span>
          )}
        </div>
      </button>
      {open && hasContent && (
        <div className="space-y-4 p-4">
          {keyCount > 0 && (
            <div>
              <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
                Adgang til lageret · {keyCount}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {h.keys.map((k) => (
                  <Link
                    key={k.identifier}
                    href={`/admin/players/${encodeURIComponent(k.identifier)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-baseline gap-1.5 rounded border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1 text-[12px] text-foreground hover:border-brand-500/40 hover:bg-[var(--bg-3)]"
                    title={k.identifier}
                  >
                    <span>{k.name ?? "ukendt spiller"}</span>
                    <span className="font-mono text-[10px] text-foreground-faint group-hover:text-foreground-muted">
                      {k.identifier.length > 22 ? `${k.identifier.slice(0, 22)}…` : k.identifier}
                    </span>
                    <span className="font-mono text-[9px] text-foreground-faint">↗</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
                Lager · {itemCount}
              </p>
              {h.inventoryUpdated && (
                <p className="font-mono text-[10.5px] text-foreground-faint">
                  opdateret {new Date(h.inventoryUpdated).toLocaleString("da-DK")}
                </p>
              )}
            </div>
            {itemCount > 0 ? (
              <ItemTable
                items={h.inventory}
                labels={labels}
                {...itemTableProps}
                removeKeyPrefix={`house:${h.id}`}
                onRemove={onRemoveItem}
              />
            ) : (
              <p className="border border-[var(--line)] py-6 text-center text-[12.5px] text-foreground-muted">
                Tomt
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Oversigt({
  user,
  stats,
  labels,
  itemTableProps,
}: {
  user: PlayerData["user"];
  stats: { vehicles: number; houses: number; items: number };
  labels: Record<string, string>;
  itemTableProps?: ItemTableProps;
}) {
  const hasMeta =
    user.metadata != null &&
    typeof user.metadata === "object" &&
    Object.keys(user.metadata as Record<string, unknown>).length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 divide-x divide-[var(--line)] border border-[var(--line)]">
        <Kpi label="Inventar" value={String(stats.items)} sub="items" />
        <Kpi label="Køretøjer" value={String(stats.vehicles)} />
        <Kpi label="Boliger" value={String(stats.houses)} />
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
            Inventar · {stats.items}
          </p>
          {itemTableProps?.canRemove && (
            <p className="font-mono text-[10.5px] text-foreground-faint">
              × = fjern item
            </p>
          )}
        </div>
        <ItemTable
          items={user.inventory}
          labels={labels}
          {...itemTableProps}
        />
      </div>

      {hasMeta && (
        <div>
          <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
            Metadata
          </p>
          <pre className="overflow-auto border border-[var(--line)] bg-[var(--bg-2)] p-3 font-mono text-[11px] text-foreground-secondary">
            {JSON.stringify(user.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
        {label}
      </p>
      <p className="mt-1 font-mono text-[18px] tabular-nums text-foreground">{value}</p>
      {sub && <p className="font-mono text-[10.5px] text-foreground-faint">{sub}</p>}
    </div>
  );
}

function Tag({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span
      className={`inline-block rounded border border-[var(--line)] bg-[var(--bg-2)] px-2 py-0.5 text-[11px] text-foreground-muted ${mono ? "font-mono" : ""}`}
    >
      {children}
    </span>
  );
}

function GroupTag({ group }: { group: string }) {
  const cls =
    group === "admin"
      ? "bg-red-900/30 text-red-400"
      : group === "superadmin"
        ? "bg-purple-900/30 text-purple-400"
        : "bg-[var(--bg-2)] text-foreground-faint";
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls}`}
    >
      {group}
    </span>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2 font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-foreground-faint ${className}`}
    >
      {children}
    </th>
  );
}
