import { getEsxPool } from "./esx-db";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import type { RowDataPacket } from "mysql2";

// Bil-tuneren har ÉN ejer. Apply (skriver handling-filer) + adgangsstyring er
// låst til dette Discord-ID alene. Tidligere var "owner" = Discord-admin-rollen
// (i praksis Supporter-rollen) → enhver supporter kunne anvende tuneren og
// adgang kunne ikke fjernes via listen, fordi den var rolle-baseret.
const OWNER_DISCORD_ID = process.env.VEHICLE_OWNER_DISCORD_ID ?? "251803503197028353";

// ───────────────────────────────────────────────────────────────────────────
// Bil-tuning "dokument": vehicle_tuning-tabellen er den fælles redigerbare
// liste (priser + ønsket topfart) for alle vehicleshop/politi/ambulance-biler.
// Claude populerer/anvender den (læser config+handling), websiden viser/redigerer.
// ───────────────────────────────────────────────────────────────────────────

export interface VehicleTuningRow {
  model: string;
  name: string;
  source: "vehicleshop" | "police" | "ambulance";
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

export interface AccessEntry {
  discord_id: string;
  label: string | null;
  added_by: string | null;
  added_at: string;
}

export async function getOverview(): Promise<VehicleTuningRow[]> {
  const [rows] = await getEsxPool().query<RowDataPacket[]>(
    `SELECT vt.model,vt.name,vt.source,vt.category,vv.buisnessID AS shop,
            vt.price,vt.target_kmh,vt.flat_vel,vt.drive_force,
            vt.brake_force,vt.traction_max,vt.drag,vt.mass,vt.drive_inertia,vt.gears,
            vt.drive_bias_front,vt.brake_bias_front,vt.handbrake_force,
            vt.traction_curve_min,vt.traction_bias_front,vt.steering_lock,
            vt.traction_loss_mult,vt.low_speed_traction_loss,
            vt.handling_name,vt.updated_by,vt.updated_at
       FROM vehicle_tuning vt
       LEFT JOIN vehicleshop_vehicles vv ON vv.model = vt.model
      ORDER BY vt.source, (vt.price IS NULL), vt.price, vt.name`
  );
  return rows as unknown as VehicleTuningRow[];
}

export async function updateRow(
  model: string,
  price: number | null,
  targetKmh: number | null,
  by: string
): Promise<void> {
  await getEsxPool().query(
    `UPDATE vehicle_tuning SET price=?, target_kmh=?, updated_by=? WHERE model=?`,
    [price, targetKmh, by, model]
  );
}

export interface BulkUpdateInput {
  model: string;
  // null = ryd feltet, undefined = lad feltet stå urørt (kolonne mangler i CSV)
  price?: number | null;
  target_kmh?: number | null;
}

export interface BulkUpdateResult {
  updated: number;
  unknown: string[];
}

/**
 * Bulk-opdatér pris + topfart fra et importeret dokument (CSV).
 * Matcher på model; rækker hvis model ikke findes i tabellen samles i `unknown`.
 * Felter med værdien undefined lades urørt, så en CSV uden fx pris-kolonnen
 * ikke nulstiller priserne.
 */
export async function bulkUpdate(
  rows: BulkUpdateInput[],
  by: string
): Promise<BulkUpdateResult> {
  if (rows.length === 0) return { updated: 0, unknown: [] };

  const pool = getEsxPool();
  const [existing] = await pool.query<RowDataPacket[]>(
    `SELECT model FROM vehicle_tuning`
  );
  const known = new Set((existing as { model: string }[]).map((r) => r.model));

  const unknown: string[] = [];
  let updated = 0;
  for (const r of rows) {
    if (!known.has(r.model)) {
      unknown.push(r.model);
      continue;
    }
    const sets: string[] = [];
    const params: (number | string | null)[] = [];
    if (r.price !== undefined) {
      sets.push("price=?");
      params.push(r.price);
    }
    if (r.target_kmh !== undefined) {
      sets.push("target_kmh=?");
      params.push(r.target_kmh);
    }
    if (sets.length === 0) continue;
    sets.push("updated_by=?");
    params.push(by, r.model);
    await pool.query(
      `UPDATE vehicle_tuning SET ${sets.join(", ")} WHERE model=?`,
      params
    );
    updated++;
  }
  return { updated, unknown };
}

export async function listAccess(): Promise<AccessEntry[]> {
  const [rows] = await getEsxPool().query<RowDataPacket[]>(
    `SELECT discord_id,label,added_by,added_at FROM web_vehicle_access ORDER BY added_at DESC`
  );
  return rows as unknown as AccessEntry[];
}

export async function addAccess(discordId: string, label: string | null, by: string): Promise<void> {
  await getEsxPool().query(
    `INSERT INTO web_vehicle_access (discord_id,label,added_by) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE label=VALUES(label)`,
    [discordId, label, by]
  );
}

export async function removeAccess(discordId: string): Promise<void> {
  await getEsxPool().query(`DELETE FROM web_vehicle_access WHERE discord_id=?`, [discordId]);
}

async function isInAccessList(discordId: string): Promise<boolean> {
  const [rows] = await getEsxPool().query<RowDataPacket[]>(
    `SELECT 1 FROM web_vehicle_access WHERE discord_id=? LIMIT 1`,
    [discordId]
  );
  return (rows as unknown as unknown[]).length > 0;
}

export interface VehicleAccess {
  discordId: string;
  username?: string;
  isOwner: boolean;
}

/** Owner = ét fast Discord-ID. Editor = på web_vehicle_access-listen. */
export async function requireVehicleEditor(): Promise<
  VehicleAccess | { error: string; status: 401 | 403 }
> {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u || !u.discordId) return { error: "Ikke logget ind", status: 401 };

  // Owner = præcis OWNER_DISCORD_ID. Ingen rolle-bagdør længere.
  if (u.discordId === OWNER_DISCORD_ID) {
    return { discordId: u.discordId, username: u.username, isOwner: true };
  }

  // Eksplicit tildelte editors må redigere dokumentet (ikke Apply). Disse kan
  // nu reelt fjernes igen, da adgang udelukkende kommer fra listen.
  if (await isInAccessList(u.discordId)) {
    return { discordId: u.discordId, username: u.username, isOwner: false };
  }
  return { error: "Ingen adgang", status: 403 };
}

/** Kun owner (OWNER_DISCORD_ID) — bruges til Apply + adgangsstyring. */
export async function requireVehicleOwner(): Promise<
  VehicleAccess | { error: string; status: 401 | 403 }
> {
  const r = await requireVehicleEditor();
  if ("error" in r) return r;
  if (!r.isOwner) return { error: "Kun owner kan gøre dette", status: 403 };
  return r;
}

/**
 * Prompt til Claude-jobbet der ANVENDER dokumentet. Worker'en kører dette med
 * fuld adgang; Claude læser vehicle_tuning + configs og tilpasser filerne.
 */
export function buildApplyPrompt(submittedBy: string): string {
  return `Du er "Bil-tuner" for FiveM-serveren Redefined (ESX). En staff (${submittedBy}) har trykket APPLY på bil-dokumentet på hjemmesiden. Anvend de ønskede priser og topfarter fra DB-tabellen vehicle_tuning på de rigtige filer.

Kør altid 'source /root/redefined-claude-creds.env' først for DB-creds (es_extended via $CLAUDE_DB_*).

FREMGANGSMÅDE:
1. Læs alle rækker: SELECT model,name,source,category,price,target_kmh,flat_vel,drive_force,drag,handling_file,handling_name FROM vehicle_tuning. Disse er ønske-værdierne.
2. PRISER (source='vehicleshop'): hvis price afviger fra nuværende vehicleshop_vehicles.price, så UPDATE vehicleshop_vehicles SET price=<price>, saleprice=NULL WHERE model=<model>.
3. HANDLING — reel topfart = min(LOFT, KRAFT-GRÆNSE), hvor LOFTET afhænger af GEAR:
     • loft_faktor = 1.2 + (nInitialDriveGears − 6) × 0.095   (clamp 1.1–1.5)   [kalibreret: 6-gear→1.2 (argento/zentorno), 8-gear→1.39 (f340r)]
     • loft_kmh    = loft_faktor × fInitialDriveMaxFlatVel
     • kraft_kmh   = 930 × sqrt(fInitialDriveForce / fInitialDragCoeff)
   Topfarten styres af LOFTET; force er OPTRÆK (0-100). Tidligere brugte jeg loft-faktor 1.39 for ALLE → 6-gear biler fik flatVel sat for lavt → toppede ved ~86% af målet. Loft-faktoren SKAL følge gearantallet.
   For at en bil REELT rammer target_kmh (T):
     a) loft_faktor = 1.2 + (gears − 6) × 0.095 (clamp 1.1–1.5)
     b) fInitialDriveMaxFlatVel = T / loft_faktor        (→ loftet = T med den faktiske loft-faktor)
     c) fInitialDriveForce = OPTRÆK for klassen (loftet holder topfarten, så høj force = hurtig 0-100 UDEN overshoot):
          økonomi/compact/sedan/suv/van/offroad/truck ≈ 0.35 · sports/muscle/coupe/sportsclassic ≈ 0.52 · super ≈ 0.62 · hyper (adder/zentorno/krieger o.l.) ≈ 0.70 · racing ≈ 0.58 · motorcykel ≈ 0.50. CLAMP 0.20–0.75.
     d) fInitialDragCoeff = fInitialDriveForce × (930 / (1.1 × T))²   (kraft-grænse ≈ 1.1×T, dvs. LIGE OVER loftet, så loftet binder og force kun er optræk — ingen overshoot). CLAMP 2.5–13.
        Tjek: loft_faktor·flatVel ≈ T, og 930·sqrt(force/drag) ≈ 1.1·T (lidt over). Top = min = T.
     e) bevar gear.
   Redigér <fInitialDriveMaxFlatVel>, <fInitialDriveForce> og evt. <fInitialDragCoeff> inde i <handlingName>=handling_name-blokken.
   KRITISK — rediger den fil spillet FAKTISK loader: ved samme handlingName i flere resources vinder den sidst-loadede (foretræk nopixel4_vehicle_handling). Verificér at handling_file peger på den AKTIVE fil; hvis vehicle_tuning's snapshot-værdier (flat_vel/drive_force/drag) ikke matcher filen, så STOL PÅ FILEN og opdater snapshottet. Filen i /opt/fivem/server-data/resources/<handling_file> er live; spejl PRÆCIST samme XML-ændring til /opt/redefined-monorepo/resources/<handling_file>.
4. Commit de ændrede filer i /opt/redefined-monorepo og push til main (som Ebou), git-co-author som sædvanlig.
5. Synkronisér dokumentet: UPDATE vehicle_tuning SET flat_vel=<ny>, drive_force=<ny>, drag=<ny> for de ændrede biler, så snapshottet matcher filen.
6. Skriv en KORT dansk rapport: hvilke biler fik ny pris/fart, og hvilke resources skal genstartes (restart <resource> + redefined_vehicleshop for priser). Spillere skal respawne bilen.

VIGTIGT: rør KUN biler der reelt er ændret ift. nuværende værdier. Intet andet. Hold dig strengt til vehicle_tuning-dokumentet.`;
}

/**
 * Prompt til SYNK-jobbet: Claude genlæser configs + handling og opdaterer
 * dokumentet, så nytilføjede biler dukker op. Ændrer IKKE spil-filer.
 */
export function buildSyncPrompt(submittedBy: string): string {
  return `Du er "Bil-tuner" for Redefined. En staff (${submittedBy}) har trykket SYNK. Genopbyg bil-dokumentet vehicle_tuning ud fra den NUVÆRENDE server-kontekst, så nytilføjede biler kommer med. Du må KUN læse spil-filer/config og kun skrive til DB-tabellen vehicle_tuning (ingen handling-filer, ingen git).

Kør 'source /root/redefined-claude-creds.env' for DB-creds.

1. Saml modeller: alle fra vehicleshop_vehicles (source=vehicleshop, med name/category/price); politi-modeller fra resources/[zaki]/zaki-police/config.lua (Config.PoliceFleetModels-keys + alle model='...'); ambulance fra resources/[zaki]/ars_ambulancejob/config.lua (Config.emsVehicles-keys).
2. For hver model: find handling i resources/**/handling.meta (match handlingName = model, ellers via <handlingId> i vehicles.meta; foretræk nopixel4_vehicle_handling ved dubletter). Udtræk fInitialDriveMaxFlatVel (flat_vel), fInitialDriveForce (drive_force), fBrakeForce (brake_force), fTractionCurveMax (traction_max), fInitialDragCoeff (drag), samt handling_file (sti relativ til resources/) og handling_name.
3. Beregn target_kmh = round( min( loft_faktor * flat_vel , 930 * sqrt(drive_force / drag) ) ) som nuværende estimat, hvor loft_faktor = 1.2 + (gears − 6) × 0.095 (clamp 1.1–1.5; gear-afhængigt, kalibreret på reel server-data: 6-gear→1.2, 8-gear→1.39). Brug IKKE en ren sqrt(drag)-formel; den overvurderer lav-drag biler groft. RØR IKKE target_kmh/price for biler der allerede findes i dokumentet — bevar staffs redigeringer; opdater kun snapshot-felterne flat_vel/drive_force/brake_force/traction_max/drag/handling_*.
4. INSERT nye modeller, UPDATE snapshot-felter på eksisterende (bevar price+target_kmh som de er, hvis de allerede er sat). Slet evt. rækker hvis modellen ikke længere findes nogen steder.
5. Kort dansk rapport: hvor mange biler i alt, hvor mange nye blev tilføjet.`;
}
