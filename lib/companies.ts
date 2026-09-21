import fs from "fs";
import path from "path";
import { getEsxPool } from "./esx-db";
import type { RowDataPacket } from "mysql2";

// Firma/society-oversigt til /admin/firmaer. Data ligger i es_extended:
//   - jobs / job_grades        → firmaer + grader (is_boss)
//   - users (job, last_seen)   → medlemmer + sidst online
//   - addon_account_data       → society-bankkonto (society_<job>)
// Logoer er kopieret fra zaki-companyapp til /public/company-logos/<job>.png.

// "Aktiv" = set inden for de sidste 7 dage.
const ACTIVE_DAYS = 7;

export interface CompanySummary {
  job: string;
  label: string;
  logo: string | null; // public-sti, fx /company-logos/police.png
  balance: number; // kr (hele kroner)
  members: number;
  active: number; // medlemmer set seneste 7 dage
  boss: string | null; // navn på chef (hvis nogen)
  lastActivity: string | null; // ISO — seneste last_seen blandt medlemmer
}

export interface CompanyMember {
  identifier: string;
  name: string;
  gradeLabel: string;
  gradeName: string | null;
  grade: number;
  isBoss: boolean;
  lastSeen: string | null; // ISO
  active: boolean;
  multiJob: boolean; // true = har firmaet gemt i companyapp-multijobs (ikke nuværende job)
}

let logoSetCache: Set<string> | null = null;
function availableLogos(): Set<string> {
  if (logoSetCache) return logoSetCache;
  try {
    const dir = path.join(process.cwd(), "public", "company-logos");
    const files = fs.readdirSync(dir);
    logoSetCache = new Set(
      files.filter((f) => f.endsWith(".png")).map((f) => f.replace(/\.png$/, ""))
    );
  } catch {
    logoSetCache = new Set();
  }
  return logoSetCache;
}

function logoFor(job: string): string | null {
  return availableLogos().has(job) ? `/company-logos/${job}.png` : null;
}

function toIso(v: Date | string | null): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function fullName(first: string | null, last: string | null): string {
  const n = `${first ?? ""} ${last ?? ""}`.trim();
  return n || "Ukendt";
}

interface JobRow extends RowDataPacket {
  name: string;
  label: string;
}
interface AggRow extends RowDataPacket {
  job: string;
  members: number;
  active: number;
  last_activity: Date | string | null;
}
interface BalanceRow extends RowDataPacket {
  account_name: string;
  money: number;
}
interface BossRow extends RowDataPacket {
  job: string;
  firstname: string | null;
  lastname: string | null;
  last_seen: Date | string | null;
}

// Delt summary-bygger til både firmaer og bander — kun job-filteret skifter.
// jobWhere er en intern konstant (ingen brugerinput) og interpoleres sikkert.
async function getJobSummaries(jobWhere: string): Promise<CompanySummary[]> {
  const pool = getEsxPool();

  const [jobs] = await pool.query<JobRow[]>(
    `SELECT name, label FROM jobs WHERE ${jobWhere} ORDER BY label ASC`
  );

  // Medlemstal + aktive + seneste aktivitet pr. nuværende job.
  const [aggs] = await pool.query<AggRow[]>(
    `SELECT job,
            COUNT(*) AS members,
            SUM(CASE WHEN last_seen >= (NOW() - INTERVAL ? DAY) THEN 1 ELSE 0 END) AS active,
            MAX(last_seen) AS last_activity
       FROM users
      WHERE job IS NOT NULL AND job <> 'unemployed'
      GROUP BY job`,
    [ACTIVE_DAYS]
  );
  const aggByJob = new Map<string, AggRow>(aggs.map((a) => [a.job, a]));

  // Society-bankkonti.
  const [balances] = await pool.query<BalanceRow[]>(
    "SELECT account_name, money FROM addon_account_data WHERE account_name LIKE 'society\\_%'"
  );
  const balByJob = new Map<string, number>();
  for (const b of balances) {
    balByJob.set(b.account_name.replace(/^society_/, ""), Number(b.money) || 0);
  }

  // Chef pr. firma (mest nyligt sete boss-grad).
  const [bosses] = await pool.query<BossRow[]>(
    `SELECT u.job AS job, u.firstname, u.lastname, u.last_seen
       FROM users u
       JOIN job_grades g ON g.job_name = u.job AND g.grade = u.job_grade
      WHERE g.is_boss = 1 AND u.job <> 'unemployed'
      ORDER BY u.last_seen DESC`
  );
  const bossByJob = new Map<string, string>();
  for (const b of bosses) {
    if (!bossByJob.has(b.job)) bossByJob.set(b.job, fullName(b.firstname, b.lastname));
  }

  return jobs.map((j) => {
    const agg = aggByJob.get(j.name);
    return {
      job: j.name,
      label: j.label || j.name,
      logo: logoFor(j.name),
      balance: balByJob.get(j.name) ?? 0,
      members: agg ? Number(agg.members) : 0,
      active: agg ? Number(agg.active) : 0,
      boss: bossByJob.get(j.name) ?? null,
      lastActivity: agg ? toIso(agg.last_activity) : null,
    };
  });
}

// Firmaer = alle jobs undtagen 'unemployed' og bander (gang1..gangN).
export function getCompanySummaries(): Promise<CompanySummary[]> {
  return getJobSummaries("name <> 'unemployed' AND name NOT LIKE 'gang%'");
}

// Bander = alle jobs der starter med 'gang' (gang1..gang25 osv.).
export function getGangSummaries(): Promise<CompanySummary[]> {
  return getJobSummaries("name LIKE 'gang%'");
}

interface MemberRow extends RowDataPacket {
  identifier: string;
  firstname: string | null;
  lastname: string | null;
  job_grade: number;
  last_seen: Date | string | null;
  grade_label: string | null;
  grade_name: string | null;
  is_boss: number | null;
}

interface GradeRow extends RowDataPacket {
  grade: number;
  name: string | null;
  label: string | null;
  is_boss: number | null;
}

interface MultiJobRow extends RowDataPacket {
  identifier: string;
  firstname: string | null;
  lastname: string | null;
  current_job: string | null;
  last_seen: Date | string | null;
  jobs: string | null;
}

// Find spillerens gemte grad for et bestemt firma i users.jobs (companyapp
// skriver et array: [{ name, jobName, grade, gradeLabel }, ...]).
function savedGradeFor(
  jobsJson: string | null,
  job: string
): { grade: number; gradeLabel: string | null } {
  if (!jobsJson) return { grade: 0, gradeLabel: null };
  try {
    const parsed = JSON.parse(jobsJson);
    if (Array.isArray(parsed)) {
      const entry = parsed.find(
        (j: { name?: string; jobName?: string; job?: string }) =>
          j && (j.name === job || j.jobName === job || j.job === job)
      );
      if (entry) {
        return {
          grade: Number(entry.grade ?? entry.job_grade ?? 0) || 0,
          gradeLabel: entry.gradeLabel ?? entry.grade_label ?? null,
        };
      }
    }
  } catch {
    /* ugyldig JSON — ignorér */
  }
  return { grade: 0, gradeLabel: null };
}

export async function getCompanyMembers(job: string): Promise<{
  label: string;
  members: CompanyMember[];
} | null> {
  const pool = getEsxPool();
  const [jobRows] = await pool.query<JobRow[]>(
    "SELECT name, label FROM jobs WHERE name = ? LIMIT 1",
    [job]
  );
  if (jobRows.length === 0) return null;

  const cutoff = Date.now() - ACTIVE_DAYS * 24 * 60 * 60 * 1000;
  const isActive = (iso: string | null) =>
    iso ? new Date(iso).getTime() >= cutoff : false;

  // 1) Nuværende ansatte (primært ESX-job).
  const [rows] = await pool.query<MemberRow[]>(
    `SELECT u.identifier, u.firstname, u.lastname, u.job_grade, u.last_seen,
            g.label AS grade_label, g.name AS grade_name, g.is_boss
       FROM users u
       LEFT JOIN job_grades g ON g.job_name = u.job AND g.grade = u.job_grade
      WHERE u.job = ?
      ORDER BY g.is_boss DESC, u.job_grade DESC, u.last_seen DESC`,
    [job]
  );

  const members: CompanyMember[] = rows.map((r) => {
    const iso = toIso(r.last_seen);
    return {
      identifier: r.identifier,
      name: fullName(r.firstname, r.lastname),
      gradeLabel: r.grade_label || `Grad ${r.job_grade}`,
      gradeName: r.grade_name,
      grade: Number(r.job_grade),
      isBoss: Boolean(r.is_boss),
      lastSeen: iso,
      active: isActive(iso),
      multiJob: false,
    };
  });
  const seen = new Set(members.map((m) => m.identifier));

  // 2) Multijob-medlemmer: spillere der har gemt firmaet i users.jobs
  //    (companyapp-multijobs), men hvor det ikke er deres nuværende job.
  const [gradeRows] = await pool.query<GradeRow[]>(
    "SELECT grade, name, label, is_boss FROM job_grades WHERE job_name = ?",
    [job]
  );
  const gradeMap = new Map<number, GradeRow>(
    gradeRows.map((g) => [Number(g.grade), g])
  );

  const [multiRows] = await pool.query<MultiJobRow[]>(
    `SELECT u.identifier, u.firstname, u.lastname, u.job AS current_job,
            u.last_seen, u.jobs
       FROM users u
      WHERE u.jobs IS NOT NULL
        AND JSON_VALID(u.jobs)
        AND (
          JSON_SEARCH(u.jobs, 'one', ?, NULL, '$[*].name')    IS NOT NULL
          OR JSON_SEARCH(u.jobs, 'one', ?, NULL, '$[*].jobName') IS NOT NULL
          OR JSON_SEARCH(u.jobs, 'one', ?, NULL, '$[*].job')     IS NOT NULL
        )`,
    [job, job, job]
  );

  const multiMembers: CompanyMember[] = [];
  for (const r of multiRows) {
    if (seen.has(r.identifier)) continue; // allerede vist som ansat
    seen.add(r.identifier);
    const { grade, gradeLabel } = savedGradeFor(r.jobs, job);
    const g = gradeMap.get(grade);
    const iso = toIso(r.last_seen);
    multiMembers.push({
      identifier: r.identifier,
      name: fullName(r.firstname, r.lastname),
      gradeLabel: g?.label || gradeLabel || `Grad ${grade}`,
      gradeName: g?.name ?? null,
      grade,
      isBoss: Boolean(g?.is_boss),
      lastSeen: iso,
      active: isActive(iso),
      multiJob: true,
    });
  }

  multiMembers.sort(
    (a, b) =>
      Number(b.isBoss) - Number(a.isBoss) ||
      b.grade - a.grade ||
      (b.lastSeen ?? "").localeCompare(a.lastSeen ?? "")
  );

  return { label: jobRows[0].label || job, members: [...members, ...multiMembers] };
}

// Bande-medlemmer bruger samme logik som firma-medlemmer (inkl. multijob).
export const getGangMembers = getCompanyMembers;
