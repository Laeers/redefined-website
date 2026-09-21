import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

// Shared helpers for the /claude remote-control feature.
// Auth is two-layered: Discord admin session (see requireAdmin) + this code.

export const SPOOL = "/opt/claude-remote";
export const QUEUE = path.join(SPOOL, "queue");
export const OUTPUT = path.join(SPOOL, "output");

const CODE_HASH = (process.env.CLAUDE_REMOTE_CODE_HASH ?? "").trim().toLowerCase();
const COOKIE_SECRET = process.env.NEXTAUTH_SECRET ?? "fallback-insecure-secret";
export const UNLOCK_COOKIE = "claude_unlock";
const UNLOCK_TTL_MS = 12 * 60 * 60 * 1000; // 12 timer

// ── Code check (constant-time) ────────────────────────────────────────────
export function checkCode(code: string): boolean {
  if (!CODE_HASH) return false;
  const given = crypto.createHash("sha256").update(code, "utf8").digest("hex");
  const a = Buffer.from(given, "hex");
  const b = Buffer.from(CODE_HASH, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ── Unlock token: HMAC-signed, bound to the admin's discordId ───────────────
function sign(payload: string): string {
  return crypto.createHmac("sha256", COOKIE_SECRET).update(payload).digest("hex");
}

export function makeUnlockToken(discordId: string): string {
  const exp = Date.now() + UNLOCK_TTL_MS;
  const payload = `${discordId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyUnlockToken(token: string | undefined, discordId: string): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [id, expStr, sig] = parts;
  if (id !== discordId) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = sign(`${id}.${expStr}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const UNLOCK_MAX_AGE_S = Math.floor(UNLOCK_TTL_MS / 1000);

// ── Rate limiter for code attempts (in-memory; single next-server proc) ─────
const attempts = new Map<string, { count: number; until: number }>();
export function rateLimit(key: string): { ok: boolean; retryMs: number } {
  const now = Date.now();
  const rec = attempts.get(key);
  if (rec && rec.until > now && rec.count >= 6) {
    return { ok: false, retryMs: rec.until - now };
  }
  return { ok: true, retryMs: 0 };
}
export function recordFail(key: string) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.until < now) {
    attempts.set(key, { count: 1, until: now + 10 * 60 * 1000 });
  } else {
    rec.count += 1;
  }
}
export function recordSuccess(key: string) {
  attempts.delete(key);
}

// ── Jobs ────────────────────────────────────────────────────────────────────
export interface JobStatus {
  id: string;
  status: "queued" | "running" | "done" | "error";
  prompt?: string;
  submittedBy?: string | null;
  submittedAt?: number | null;
  startedAt?: number;
  finishedAt?: number;
  exitCode?: number;
  error?: string;
  output?: string;
  meta?: Record<string, unknown> | null;
}

export function newJobId(): string {
  // Time-sortable + random suffix.
  return `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

export async function enqueueJob(job: {
  id: string;
  prompt: string;
  continue: boolean;
  submittedBy: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const doc = { ...job, submittedAt: Date.now() };
  // Write status doc first (so the UI sees "queued"), then the queue file.
  await fsp.writeFile(
    path.join(OUTPUT, `${job.id}.json`),
    JSON.stringify({ ...doc, status: "queued" })
  );
  // Atomic-ish enqueue: write to tmp then rename into queue.
  const tmp = path.join(QUEUE, `.${job.id}.tmp`);
  await fsp.writeFile(tmp, JSON.stringify(doc));
  await fsp.rename(tmp, path.join(QUEUE, `${job.id}.json`));
}

export async function readJob(id: string, withOutput = true): Promise<JobStatus | null> {
  if (!/^[0-9]+-[0-9a-f]{8}$/.test(id)) return null;
  try {
    const doc = JSON.parse(
      await fsp.readFile(path.join(OUTPUT, `${id}.json`), "utf8")
    ) as JobStatus;
    if (withOutput) {
      try {
        doc.output = await fsp.readFile(path.join(OUTPUT, `${id}.log`), "utf8");
      } catch {
        doc.output = "";
      }
    }
    return doc;
  } catch {
    return null;
  }
}

export async function listRecentJobs(limit = 20): Promise<JobStatus[]> {
  let files: string[] = [];
  try {
    files = (await fsp.readdir(OUTPUT)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  files.sort().reverse();
  const out: JobStatus[] = [];
  for (const f of files.slice(0, limit)) {
    try {
      const doc = JSON.parse(
        await fsp.readFile(path.join(OUTPUT, f), "utf8")
      ) as JobStatus;
      out.push({
        id: doc.id,
        status: doc.status,
        prompt: doc.prompt,
        submittedBy: doc.submittedBy,
        submittedAt: doc.submittedAt,
        startedAt: doc.startedAt,
        finishedAt: doc.finishedAt,
        exitCode: doc.exitCode,
        meta: doc.meta ?? null,
      });
    } catch {}
  }
  return out;
}

export function spoolReady(): boolean {
  try {
    return fs.existsSync(QUEUE) && fs.existsSync(OUTPUT);
  } catch {
    return false;
  }
}
