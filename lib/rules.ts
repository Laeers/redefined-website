import { getPool } from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// Reglerne på /regler ligger i databasen (redefined_web) og kan redigeres af
// Senior Admin+ via /admin/regler. Første gang tabellerne er tomme, seeder vi
// det oprindelige (tidligere hardcodede) indhold som Markdown, så der altid
// "sidder noget der kan redigeres med det samme".

export interface RuleSection {
  id: number;
  slug: string;
  nav_label: string;
  eyebrow: string;
  title: string;
  body: string; // Markdown (GFM)
  position: number;
  is_published: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

export interface RulesMeta {
  page_eyebrow: string;
  page_title: string;
  page_description: string;
}

interface SectionRow extends RowDataPacket {
  id: number;
  slug: string;
  nav_label: string;
  eyebrow: string;
  title: string;
  body: string;
  position: number;
  is_published: number;
  updated_at: Date | string | null;
  updated_by: string | null;
}

interface MetaRow extends RowDataPacket {
  k: string;
  v: string;
}

const DEFAULT_META: RulesMeta = {
  page_eyebrow: "Server-regler",
  page_title: "Frihed under ansvar — sådan spiller vi her.",
  page_description:
    "Regelsættet er ikke en lovbog. Det er et fundament. Forstår du tonen, falder resten på plads. Læs det, og lad sund fornuft håndtere alt det vi har valgt ikke at skrive ned.",
};

// Det oprindelige regelsæt, konverteret til Markdown. Bruges kun som seed —
// herefter er sandheden databasen.
const DEFAULT_SECTIONS: Omit<RuleSection, "id" | "updated_at" | "updated_by">[] = [
  {
    slug: "vision",
    nav_label: "Vision",
    eyebrow: "Vision",
    title: "Det handler om at lade fortællingen leve.",
    is_published: true,
    position: 0,
    body: `Vi har én grundlæggende overbevisning: at det bedste RP hverken opstår når alting er tilladt, eller når alting er reguleret. Det opstår dér, hvor spillere har plads til at tage karakteren et sted hen — og samtidig kan stå inde for hvad det koster.

Det er hvad vi mener, når vi siger **frihed under ansvar**. Vi tror på spillere der både kan og vil bidrage til en levende, kreativ og indlevende by — og som forbliver tro mod deres karakter, også når scenariet bliver besværligt.

Det vi prioriterer er fortællinger der føles ægte, karakterudvikling der har konsekvens, og scenarier der inspirerer andre til selv at være kreative. Med den frihed følger nogle få, ufravigelige forventninger:

- Du bidrager aktivt til de scenarier du indgår i og bryder ikke karakter undervejs.
- Du spiller med øje for at løfte både din egen og dine medspilleres oplevelse.
- Du forstår at indlevende RP er holdarbejde — også når det går dig imod.`,
  },
  {
    slug: "alder",
    nav_label: "Aldersgrænse",
    eyebrow: "Aldersgrænse",
    title: "Vi kræver du er fyldt 18.",
    is_published: true,
    position: 1,
    body: `Aldersgrænsen på Redefined er **18+**. Der er ingen undtagelser. Vi forbeholder os retten til at bede om verifikation ved tvivl.`,
  },
  {
    slug: "generelt",
    nav_label: "Generelle regler",
    eyebrow: "Generelle regler",
    title: "Gælder for alle — uden undtagelse.",
    is_published: true,
    position: 2,
    body: `- **Mobning og nedværdigelse** — Redefined har nultolerance over for mobning, chikane og nedværdigelse af andre spillere, både i og uden for karakter. Det skaber en negativ oplevelse og strider direkte mod alt hvad vi bygger på.
- **Tredjepartsprogrammer** — Enhver form for cheat, AI-filer, mod-menuer, no-bushes, tracers eller tilsvarende software medfører permanent ban. Det er en af de regler, der ikke har nuancer.
- **Bugs og glitches** — Det er dit ansvar at rapportere fejl, du støder på. Fanges du i at udnytte en bug — uanset hvor ubetydeligt det virker — er resultatet permanent ban.
- **Hold dig opdateret** — Du har selv ansvaret for at holde dig ajour med regelændringer. De kommunikeres på Discord. "Det vidste jeg ikke" er aldrig en undskyldning.
- **AFK-politik** — Du må ikke stå AFK i mere end 15 minutter. Undtagelser gælder ved gameplay, der kræver stilstand (marker, laboratorier osv.).
- Staff kan til enhver tid bortvise spillere fra serveren. Diskussioner om bortvisninger hører hjemme i en ticket — aldrig i offentlige kanaler.`,
  },
  {
    slug: "rp",
    nav_label: "Rollespil & karakter",
    eyebrow: "Rollespil & karakter",
    title: "Din karakter er din kontrakt med byen.",
    is_published: true,
    position: 3,
    body: `- **Metagaming** — Du må ikke benytte viden tilegnet uden for spillet: streams, Discord-DMs, en ven der fortæller noget OOC. Hvis din karakter ikke har oplevet det in-game, ved den det ikke. Det er desuden forbudt at se en stream fra Redefined, mens du selv er ingame — for at eliminere stream-sniping og tvivl.
- **New Life Rule (NLR)** — Dør du, glemmer din karakter alt der skete op til døden. Du må ikke hævne dig og skal vente med at vende tilbage til dødsstedet i en passende periode.
- **Random Deathmatch (RDM)** — Du skal altid have en gyldig, RP-baseret grund til at angribe eller dræbe en anden spiller. Tilfældig vold uden kontekst er regelbrud.
- **Vehicle Deathmatch (VDM)** — Dit køretøj er ikke et våben. Bevidst at køre ind i andre spillere uden RP-grundlag behandles på linje med RDM.
- **Fear RP** — Du frygter for dit liv, præcis som du ville i virkeligheden. Er du under gunpoint eller knivspoint, skal du agere derefter. Du må godt forsøge modstand, men dør du i takt med brud på Fear RP, er det et gyldigt CK-grundlag. Eksempler:
    - En betjent stormer bande-grund alene — velvidende om at han er i stærkt undertal.
    - Du er under gunpoint, men trækker alligevel dit våben og dør i forsøget.
    - Du opsøger en gruppe, der er kendt for aggressivitet, og løber maskeret ind på deres grund.
- **Fail RP** — Bevidste brud på rationel rollespil, der ødelægger den realistiske og engagerende oplevelse for andre. Udfører du handlinger, der strider direkte mod sund fornuft og din karakterrolle, betragtes det som Fail RP.
- **Konfliktoptrapning** — Du må ikke eskalere situationer unødigt eller starte slagsmål, der nemt kunne være undgået. Antallet af knivdrab og lignende skal holdes realistisk.
- **Røveri for egen vinding** — Røveri udelukkende for personlig berigelse uden videregående RP er forbudt. At sætte sig ind i et køretøj og stikke af uden at give offeret mulighed for at RP på det er regelbrud.
- **Bryd ikke RP** — Du forbliver din karakter, også når scenariet er presset eller kedeligt. "Det var bare for sjov" tæller ikke.`,
  },
  {
    slug: "firmaer",
    nav_label: "Firmaer",
    eyebrow: "Firmaer",
    title: "En virksomhed er et ansvar — ikke bare en indtægtskilde.",
    is_published: true,
    position: 4,
    body: `- **Udelukkelse** — Får du ban i 14 dage eller længere, mister du ejerskab over din virksomhed. Den kan sættes på tvangsauktion.
- **Ændringer** — Salg, ejerskifte, bonussystemer, omsætningsændringer og lignende skal godkendes af firma-ansvarlige. Hold dem opdateret.
- **Ulovlig aktivitet** — Lovlige virksomheder må ikke misbruges til at fremme ulovlige formål — det betragtes som korruption. Bliver du som ejer taget i kriminalitet, kan politiet og domstolen fratage virksomheden i RP.
- **Ansøgning** — Din firma-ansøgning skal holdes opdateret med medarbejderliste og relevante oplysninger.
- **Prioritering** — Når virksomheden er godkendt, forventes det at virksomhedsejeren prioriterer den karakter som hovedkarakter.
- **Overdragelse** — Modtager du en virksomhed gratis og sælger den videre, vurderer firma-ansvarlige hvad du har fortjent ud fra aktivitet, indsats og salgspris.`,
  },
  {
    slug: "bander",
    nav_label: "Bande-RP",
    eyebrow: "Bande-RP",
    title: "Selvbestemmelse — men ikke uden konsekvens.",
    is_published: true,
    position: 5,
    body: `- **Udelukkelse** — Ban i 14 dage eller længere koster ejerskab over banden. Bande-ansvarlige vurderer om banden kan fortsætte.
- **Medlemstal** — En bande må have op til 24 medlemmer. Derudover er det tilladt med op til 8 pushere — pushere tæller ikke med i de 24.
- **Pushere** — Pushere må ikke inddrages i bande-RP: bandekrige, bandemøder eller lignende scenarier.
- **Alliancer** — Bander må indgå alliancer med andre grupperinger om fælles mål, dialog og samarbejde på tværs.
- **Bande-exit** — Forlader du en bande, får du 14 dages cooldown. Fremgangsmåden for exit afhænger af bandens ansøgning/ticket.
- **Territorier** — Du ejer kun et område, hvis det er overtaget via zone-systemet. RP-faciliteter (butikker, tatovører, frisører, garager) kan frit bruges af alle og kan ikke ejes, medmindre banden ejer et firma hertil.
- **Ejendomme** — Overtagelse og køb af ejendomme sker via Redefineds ejendomsmæglere i RP. Bander har ret til at forsvare sine ejendomme, hvis uvedkommende trænger ind.
- **Beskyttelsespenge** — Bander må opkræve betaling på marker, omdannere osv. inden for egne zoner, med disse vilkår:
    - Maks. 350.000 om ugen pr. borger.
    - Nægter borgeren, bed vedkommende om at forlade stedet. Vold er kun tilladt hvis de ikke adlyder.
    - Banden skal bære fuld markering ved indkrævning.
    - Gør det tydeligt for borgerne, at banden ejer området, før betaling opkræves.`,
  },
  {
    slug: "bandekrig",
    nav_label: "Bandekrig & strikes",
    eyebrow: "Bandekrig & strikes",
    title: "Reglerne gælder også i krig.",
    is_published: true,
    position: 6,
    body: `- **Krigsregler** — Aftales internt i Support med bande-ansvarlige og under fælles aftale mellem de involverede bander. Krigen foregår ingame — had, tilsvininger og lignende resulterer i udelukkelse fra krige fremover. Alle øvrige regler gælder fortsat.
- **Strikes** — En bande kan få op til 3 strikes afhængigt af regelbruddet. Ved tredje strike vurderer bande-ansvarlige, om banden kan fortsætte på Redefined.`,
  },
  {
    slug: "content",
    nav_label: "Stream & content",
    eyebrow: "Stream & content",
    title: "Du repræsenterer mere end dig selv.",
    is_published: true,
    position: 7,
    body: `Når du streamer eller laver indhold fra Redefined, er du en del af serverens udadvendte ansigt. Du må gerne være kritisk, men der er en afgørende forskel på saglig kritik og personlige angreb.

- Personlige angreb, nedladende kommentarer eller systematisk dårlig omtale af spillere, staff eller communityet er ikke acceptabelt.
- Brug ticket-systemet til faktiske problemer — ikke streamen.
- Andre spillere har ret til at sige nej til at være i din content. Respekter det.
- Tænk over hvordan både din karakter og serveren fremstår, før du trykker upload. Det du poster i dag, eksisterer stadig om to år.

Bryder du de her retningslinjer gentagne gange, kan vi udelukke dig eller fjerne dine content-rettigheder.`,
  },
];

function mapSection(r: SectionRow): RuleSection {
  return {
    id: r.id,
    slug: r.slug,
    nav_label: r.nav_label,
    eyebrow: r.eyebrow,
    title: r.title,
    body: r.body,
    position: r.position,
    is_published: Boolean(r.is_published),
    updated_at:
      r.updated_at instanceof Date
        ? r.updated_at.toISOString()
        : (r.updated_at as string | null),
    updated_by: r.updated_by,
  };
}

let seedPromise: Promise<void> | null = null;

async function seedRulesIfEmpty(): Promise<void> {
  // Kør seed højst én gang pr. proces (undgå race ved parallelle requests).
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM rules_sections"
    );
    const count = Number((rows[0] as { n: number }).n);
    if (count === 0) {
      for (const s of DEFAULT_SECTIONS) {
        await pool.execute(
          `INSERT INTO rules_sections (slug, nav_label, eyebrow, title, body, position, is_published, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE slug = slug`,
          [s.slug, s.nav_label, s.eyebrow, s.title, s.body, s.position, s.is_published ? 1 : 0, "seed"]
        );
      }
    }
    const [metaRows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM rules_meta"
    );
    if (Number((metaRows[0] as { n: number }).n) === 0) {
      for (const [k, v] of Object.entries(DEFAULT_META)) {
        await pool.execute(
          `INSERT INTO rules_meta (k, v, updated_by) VALUES (?, ?, 'seed')
           ON DUPLICATE KEY UPDATE k = k`,
          [k, v]
        );
      }
    }
  })().catch((e) => {
    // Nulstil så et nyt forsøg kan ske ved næste request hvis seed fejlede.
    seedPromise = null;
    throw e;
  });
  return seedPromise;
}

export async function getRulesMeta(): Promise<RulesMeta> {
  await seedRulesIfEmpty();
  const pool = getPool();
  const [rows] = await pool.query<MetaRow[]>("SELECT k, v FROM rules_meta");
  const meta = { ...DEFAULT_META };
  for (const r of rows) {
    if (r.k in meta) (meta as Record<string, string>)[r.k] = r.v;
  }
  return meta;
}

export async function getPublishedSections(): Promise<RuleSection[]> {
  await seedRulesIfEmpty();
  const pool = getPool();
  const [rows] = await pool.query<SectionRow[]>(
    "SELECT * FROM rules_sections WHERE is_published = 1 ORDER BY position ASC, id ASC"
  );
  return rows.map(mapSection);
}

export async function getAllSections(): Promise<RuleSection[]> {
  await seedRulesIfEmpty();
  const pool = getPool();
  const [rows] = await pool.query<SectionRow[]>(
    "SELECT * FROM rules_sections ORDER BY position ASC, id ASC"
  );
  return rows.map(mapSection);
}

export interface SectionInput {
  slug: string;
  nav_label: string;
  eyebrow: string;
  title: string;
  body: string;
  is_published: boolean;
}

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "oe")
    .replace(/[å]/g, "aa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function createSection(
  input: SectionInput,
  updatedBy: string
): Promise<number> {
  const pool = getPool();
  const slug = normalizeSlug(input.slug || input.nav_label || input.title) || `sektion-${Date.now()}`;
  const [maxRows] = await pool.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM rules_sections"
  );
  const position = Number((maxRows[0] as { pos: number }).pos);
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO rules_sections (slug, nav_label, eyebrow, title, body, position, is_published, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      input.nav_label,
      input.eyebrow,
      input.title,
      input.body,
      position,
      input.is_published ? 1 : 0,
      updatedBy,
    ]
  );
  return res.insertId;
}

export async function updateSection(
  id: number,
  input: SectionInput,
  updatedBy: string
): Promise<void> {
  const pool = getPool();
  const slug = normalizeSlug(input.slug || input.nav_label || input.title) || `sektion-${id}`;
  await pool.execute(
    `UPDATE rules_sections
       SET slug = ?, nav_label = ?, eyebrow = ?, title = ?, body = ?, is_published = ?, updated_by = ?
     WHERE id = ?`,
    [
      slug,
      input.nav_label,
      input.eyebrow,
      input.title,
      input.body,
      input.is_published ? 1 : 0,
      updatedBy,
      id,
    ]
  );
}

export async function deleteSection(id: number): Promise<void> {
  const pool = getPool();
  await pool.execute("DELETE FROM rules_sections WHERE id = ?", [id]);
}

export async function reorderSections(
  orderedIds: number[],
  updatedBy: string
): Promise<void> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < orderedIds.length; i++) {
      await conn.execute(
        "UPDATE rules_sections SET position = ?, updated_by = ? WHERE id = ?",
        [i, updatedBy, orderedIds[i]]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateMeta(
  patch: Partial<RulesMeta>,
  updatedBy: string
): Promise<void> {
  const pool = getPool();
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in DEFAULT_META)) continue;
    await pool.execute(
      `INSERT INTO rules_meta (k, v, updated_by) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE v = VALUES(v), updated_by = VALUES(updated_by)`,
      [k, v ?? "", updatedBy]
    );
  }
}
