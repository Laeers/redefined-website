import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import {
  enqueueJob,
  readJob,
  newJobId,
  spoolReady,
  listRecentJobs,
} from "@/lib/claude-remote";

export const dynamic = "force-dynamic";

const MAX_QUESTION = 4000;

// System-prompt der gør Claude-jobbet til en READ-ONLY forensisk detektiv.
// NB: worker'en kører som root, så read-only er en INSTRUKTION (soft guardrail),
// ikke en hård grænse — derfor er detektiven kun for admins (requireAdmin).
const DETECTIVE_PREAMBLE = `Du er "Detektiven" — et READ-ONLY forensisk værktøj for staff på FiveM-serveren Redefined (ESX, oxmysql, ox_inventory).

ABSOLUTTE REGLER:
- KUN læsning. Du må UDELUKKENDE køre SELECT/SHOW-queries mod databasen.
- ALDRIG INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE eller andre skrivninger.
- ALDRIG ændre filer, redigere kode, genstarte resources, banne/kicke, eller køre destruktive shell-kommandoer.
- ALDRIG røre noget uden for databaseundersøgelsen. Hvis du bliver bedt om at ændre noget: afvis høfligt og forklar at detektiven kun læser.
- Svar ALTID på dansk, kort og konkret som en efterforsknings-rapport (navne, discord, beløb, tidspunkter). Dump ikke rå rækker medmindre det er nødvendigt.

RAPPORT-FORMAT (VIGTIGT — output renderes som markdown i et pænt UI, så formatér det godt):
- Start med en kort '## Konklusion' (2-4 linjer) der svarer direkte på spørgsmålet — den vigtigste pointe først.
- Brug **markdown-tabeller** når du viser flere spillere/beløb/hændelser — ALDRIG lange tekstlister. Kolonner fx | Spiller | Discord | Beløb | Kilde | Tidspunkt |. Vis discord som <@ID>.
- Formatér tal pænt med tusind-separator (fx 1.250.000 kr).
- Brug overskrifter (##, ###), **fed** til navne/beløb, og punktlister hvor det giver mening.
- Når du forklarer en PENGE-/ITEM-STRØM eller relation mellem spillere (hvem gav hvad til hvem), så tegn et diagram med en mermaid-blok, fx:
  \`\`\`mermaid
  flowchart LR
    A["Noah Hebo"] -->|"3x coke, 14:32"| B["Modtager"]
  \`\`\`
  Brug graph/flowchart til strømme og 'sequenceDiagram' til hændelsesforløb over tid. Hold labels korte og pak tekst i dobbelte anførselstegn.
- Afslut evt. med '### Vurdering' (er det snyd? hvor sikker er du?) og '### Anbefaling' til staff.
- Skriv KUN rapporten — ingen rå SQL eller shell-kommandoer i svaret medmindre du udtrykkeligt bliver bedt om det.

DATABASE-ADGANG (TO databaser — kør altid 'source /root/redefined-claude-creds.env' først):
- SPIL-DATA (users, owned_vehicles, ox_inventory, accounts, alt nuværende tilstand) er i databasen 'es_extended':
    mysql -u "$CLAUDE_DB_USER" -p"$CLAUDE_DB_PASS" "$CLAUDE_DB_NAME" -e "SELECT ..."
- LOGS (zaki_logs — ALLE hændelser, inkl. ox_inventory.move som er nøglen til trunk/stash-tyveri) er i en SEPARAT log-database 'redefined_web'. Brug ALTID disse creds til zaki_logs:
    mysql -u "$CLAUDE_LOGDB_USER" -p"$CLAUDE_LOGDB_PASS" "$CLAUDE_LOGDB_NAME" -e "SELECT ..."
  VIGTIGT: zaki_logs findes KUN i redefined_web (CLAUDE_LOGDB_*). I es_extended er zaki_logs TOM — query den ALDRIG der.
- 'rows' er reserveret ord i MariaDB (brug et andet alias). Pas på æøå/ö i shell — lav helst JOIN inde i SQL frem for at sende navne via shell.

NØGLE-SKEMA:
- users: identifier (char1:<rockstar>), accounts (JSON: bank/money/black_money), firstname, lastname, job, job_grade, inventory (JSON-array af items {name,count,...}). Spiller-formue = sum af accounts.
- owned_vehicles: owner (= users.identifier), plate, vehicle, stored, parked.
- ox_inventory: name (stash-id, fx 'trunk<PLADE>' / 'glove<PLADE>'), data (JSON-array af items).
- zaki_logs (CENTRAL log — ligger i redefined_web, brug CLAUDE_LOGDB_*): created_at, resource, category, action, severity (debug/info/warn/critical), message, identifier, license, discord, player_name (= steam/display-navn), esx_name (= karakter firstname+lastname), job, amount, item, target_identifier, target_name, metadata_json, coords. TRUNK/STASH-TYVERI: filtrér action='ox_inventory.move' og parse metadata_json (fromInventory/toInventory/fromType/toType) — stash-id'er er fx 'trunk<PLADE>'/'glove<PLADE>'. 'identifier' = hvem der flyttede.
- 'money' og 'black_money' findes BÅDE som konto (users.accounts) OG som ox_inventory-items.

VIGTIG TIDSGRÆNSE:
- Serveren ÅBNEDE 2026-05-30 kl 18:00. Der findes INGEN gyldige data før det. Filtrér ALTID zaki_logs på created_at >= '2026-05-30 18:00:00' og ignorér alt ældre (det er test/seed-data og må ikke indgå i vurderinger).

NYTTIG VIDEN (kendte mønstre):
- Drug-farm logges som action='drugs.farm'; legitim mængde pr. gang er lille (8-12). amount>15 = dupe-misbrug.
- Penge-skabelse logges som 'economy.money_item_add' (warn) og 'economy.money_loop_suspected' (high, trigger-loops) med metadata.invokingResource.
- Konto-ændringer logges som 'economy.account_add/remove/set'.
- ox_inventory.move-logs har metadata_json med fromInventory/toInventory/fromType/toType — brug til at spore flytninger mellem spillere/trunks/drops.
- Coke i bagagerum/handskerum = ox_inventory-stashes 'trunk<plade>'/'glove<plade>'. JSON-beholdninger kan parses med JSON_TABLE (MariaDB 10.11).
- Søg på esx_name for en karakter; discord-kolonnen er Discord-ID (vis som <@ID>).

FALSKE POSITIVER (undgå at råbe ulv):
- REVISORER (job='revisor', evt. 'accountant') håndterer LEGITIMT store mængder black_money som en del af jobbet — det er deres rolle at vaske/omsætte sorte penge for andre. Store black_money-beløb hos en revisor er NORMALT og i sig selv IKKE mistænkeligt. Markér kun en revisor som snyd hvis selve KILDEN er ulovlig (dupe/faucet/loop/'economy.money_item_add'/'money_loop_suspected'), ikke bare fordi mængden er stor. Nævn gerne i rapporten når et stort beløb forklares af revisor-jobbet, så staff ikke jagter en blindgyde.

OPGAVE: Besvar staff-medlemmets spørgsmål nedenfor ved at undersøge databasen (kun læsning) og skriv en kort, klar rapport.

SPØRGSMÅL FRA STAFF:
`;

// Træk det rene staff-spørgsmål ud af et job (nye jobs har det i meta.question;
// ældre jobs har kun den fulde prompt med preamble foran).
function questionOf(job: { meta?: Record<string, unknown> | null; prompt?: string }): string {
  const q = job.meta?.question;
  if (typeof q === "string" && q.trim()) return q.trim();
  const p = job.prompt ?? "";
  const marker = "SPØRGSMÅL FRA STAFF:\n";
  const i = p.indexOf(marker);
  return (i >= 0 ? p.slice(i + marker.length) : p).trim();
}

function isDetective(job: {
  meta?: Record<string, unknown> | null;
  submittedBy?: string | null;
}): boolean {
  return job.meta?.kind === "detective" || (job.submittedBy ?? "").startsWith("detektiv:");
}

function askedBy(submittedBy?: string | null): string {
  const s = submittedBy ?? "";
  return s.startsWith("detektiv:") ? s.slice("detektiv:".length) : s || "ukendt";
}

// Normalisér et spørgsmål så "samme" spørgsmål kan genkendes (token-besparelse).
function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const REUSE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 timer

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const job = await readJob(id, true);
    if (!job) return NextResponse.json({ error: "Ukendt undersøgelse." }, { status: 404 });
    return NextResponse.json(job);
  }
  // Delt historik: alle detektiv-undersøgelser, synlig for alle admins.
  if (req.nextUrl.searchParams.get("list")) {
    const jobs = await listRecentJobs(80);
    const items = jobs
      .filter(isDetective)
      .map((j) => ({
        id: j.id,
        question: questionOf(j),
        status: j.status,
        askedBy: askedBy(j.submittedBy),
        submittedAt: j.submittedAt ?? null,
        finishedAt: j.finishedAt ?? null,
      }))
      .slice(0, 50);
    return NextResponse.json({ items });
  }
  return NextResponse.json({ ok: true, ready: spoolReady() });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  if (!spoolReady()) {
    return NextResponse.json(
      { error: "Detektiv-worker ikke klar (/opt/claude-remote)." },
      { status: 503 },
    );
  }

  let question = "";
  let force = false;
  try {
    const body = await req.json();
    question = typeof body?.question === "string" ? body.question : "";
    force = body?.force === true;
  } catch {
    // ignore
  }
  question = question.trim();
  if (!question) {
    return NextResponse.json({ error: "Skriv et spørgsmål til detektiven." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION) question = question.slice(0, MAX_QUESTION);

  // Token-besparelse: hvis nøjagtigt samme spørgsmål allerede er besvaret inden
  // for 12 timer, så genbrug det svar i stedet for at køre en ny undersøgelse.
  // 'force' (Undersøg igen) springer cachen over.
  if (!force) {
    const norm = normalizeQuestion(question);
    const recent = (await listRecentJobs(80)).find(
      (j) =>
        isDetective(j) &&
        j.status === "done" &&
        normalizeQuestion(questionOf(j)) === norm &&
        (j.finishedAt ?? j.submittedAt ?? 0) > Date.now() - REUSE_WINDOW_MS,
    );
    if (recent) {
      return NextResponse.json({
        id: recent.id,
        reused: true,
        reusedAt: recent.finishedAt ?? recent.submittedAt ?? null,
        reusedBy: askedBy(recent.submittedBy),
      });
    }
  }

  const id = newJobId();
  // continue:false → hver undersøgelse er en frisk, selvstændig session (deler
  // ikke kontekst med admin /claude-konsollen).
  await enqueueJob({
    id,
    prompt: DETECTIVE_PREAMBLE + question,
    continue: false,
    submittedBy: `detektiv:${guard.username ?? guard.discordId}`,
    meta: { kind: "detective", question },
  });
  return NextResponse.json({ id });
}
