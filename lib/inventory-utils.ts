export interface OxItem {
  name: string;
  count: number;
  slot: number;
  metadata?: Record<string, unknown>;
}

export function normalizeInventory(raw: unknown): OxItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((i) => i && typeof i === "object" && Number(i.count) > 0) as OxItem[];
  }
  if (typeof raw === "object") {
    return Object.values(raw as Record<string, OxItem>).filter((i) => i && Number(i.count) > 0);
  }
  return [];
}

/** Fjern hele stacken i et slot. Gemmer som ox_inventory minimal-array. */
export function removeItemBySlot(
  raw: unknown,
  slot: number
): { updated: OxItem[]; removed: OxItem | null } {
  const items = normalizeInventory(raw);
  const removed = items.find((i) => i.slot === slot) ?? null;
  const updated = items.filter((i) => i.slot !== slot);
  return { updated, removed };
}
