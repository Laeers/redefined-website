/**
 * Delt konfiguration + helpers til capture-upload-API'et.
 *
 * straye-capture (FiveM) uploader screenshots til /api/capture/upload via sin
 * "custom" provider. Filerne gemmes i en PERSISTENT mappe uden for website-
 * deployet (rsync --delete ville ellers slette dem ved hver deploy) og serveres
 * tilbage via /api/capture/file/<sti> så Discord kan hente dem direkte.
 *
 * Env:
 *   CAPTURE_UPLOAD_TOKEN     — delt hemmelighed. SKAL matche straye-capture's
 *                              custom.headers['x-capture-token']. Tom = API'et
 *                              afviser alt (sikker default).
 *   CAPTURE_UPLOAD_DIR       — absolut sti til lagring (default /opt/redefined-uploads)
 *   CAPTURE_PUBLIC_BASE_URL  — public base for returnerede URL'er
 *                              (default https://redefinedrp.dk/api/capture/file)
 *   CAPTURE_MAX_SIZE_MB      — max filstørrelse i MB (default 64)
 */

import path from "node:path";

export const UPLOAD_DIR =
  process.env.CAPTURE_UPLOAD_DIR ?? "/opt/redefined-uploads";

export const PUBLIC_BASE_URL = (
  process.env.CAPTURE_PUBLIC_BASE_URL ??
  "https://redefinedrp.dk/api/capture/file"
).replace(/\/+$/, "");

export const MAX_SIZE_BYTES =
  Math.max(1, Number(process.env.CAPTURE_MAX_SIZE_MB ?? "64")) * 1024 * 1024;

export const UPLOAD_TOKEN = process.env.CAPTURE_UPLOAD_TOKEN ?? "";

// Tilladte mime-typer → fil-extension.
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/webm": "webm",
  "video/mp4": "mp4",
  "video/x-matroska": "mkv",
  // lb-phone uploader også lyd (voice messages / optagelser).
  "audio/webm": "weba",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  webm: "video/webm",
  mp4: "video/mp4",
  mkv: "video/x-matroska",
  weba: "audio/webm",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
};

export function extForMime(mime: string | undefined | null): string | null {
  if (!mime) return null;
  // MediaRecorder sender fx "video/webm;codecs=vp8,opus" — strip parametrene
  // efter ";" så base-typen (video/webm) matcher allowlisten. Uden dette afviste
  // upload-API'et alle optagelser med 415 Unsupported Media Type.
  const base = mime.split(";")[0].trim().toLowerCase();
  return MIME_TO_EXT[base] ?? null;
}

export function mimeForExt(ext: string): string {
  return EXT_TO_MIME[ext.toLowerCase()] ?? "application/octet-stream";
}

/**
 * Validerer en token mod den konfigurerede hemmelighed.
 * Returnerer false hvis ingen token er sat (fail-closed).
 */
export function isAuthorized(provided: string | null | undefined): boolean {
  if (!UPLOAD_TOKEN) return false;
  if (!provided) return false;
  // Tillad både "Bearer xxx" og rå token.
  const value = provided.startsWith("Bearer ")
    ? provided.slice(7).trim()
    : provided.trim();
  // Konstant-tid-ish sammenligning.
  if (value.length !== UPLOAD_TOKEN.length) return false;
  let diff = 0;
  for (let i = 0; i < value.length; i++) {
    diff |= value.charCodeAt(i) ^ UPLOAD_TOKEN.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Bygger en relativ lagrings-sti: <YYYY>/<MM>/<DD>/<random>.<ext>
 */
export function buildRelPath(ext: string): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand =
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36);
  return `${yyyy}/${mm}/${dd}/${rand}.${ext}`;
}

/**
 * Saniterer en bruger-leveret sti og resolver den sikkert inden for UPLOAD_DIR.
 * Returnerer null ved path-traversal eller ugyldige tegn.
 */
export function resolveSafe(relParts: string[]): string | null {
  const rel = relParts.join("/");
  if (!/^[A-Za-z0-9_\-/.]+$/.test(rel)) return null;
  if (rel.includes("..")) return null;
  const abs = path.resolve(UPLOAD_DIR, rel);
  const base = path.resolve(UPLOAD_DIR);
  if (abs !== base && !abs.startsWith(base + path.sep)) return null;
  return abs;
}
