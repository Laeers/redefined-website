// Klient mod zaki-livescreen's HTTP-API på spilserveren (samme maskine, localhost).
// Sikret med delt token (header x-livescreen-token = env LIVESCREEN_TOKEN, samme
// værdi som convar `livescreen_token` i server.cfg).

const GAME_BASE = process.env.LIVESCREEN_GAME_URL ?? "http://127.0.0.1:30120/zaki-livescreen";
const TOKEN = process.env.LIVESCREEN_TOKEN ?? "";

export type OnlinePlayer = {
  serverId: number;
  name: string;
  identifier?: string;
  job?: string;
  watching?: boolean;
};

export type LiveClip = {
  url: string;
  ts: number;
  seq: number;
};

export type WatchResult = {
  ok: boolean;
  online?: boolean;
  clips?: LiveClip[];
  clipMs?: number;
  error?: string;
  max?: number;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!TOKEN) throw new Error("LIVESCREEN_TOKEN ikke sat");
  const res = await fetch(`${GAME_BASE}${path}`, {
    ...init,
    headers: {
      "x-livescreen-token": TOKEN,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    // Spilserveren er lokal; et kort timeout undgår at en nede server hænger requesten.
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`livescreen ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export async function getOnline(): Promise<OnlinePlayer[]> {
  const j = await call<{ players?: OnlinePlayer[] }>("/online");
  return j.players ?? [];
}

export async function watch(
  serverId: number,
  adminId: string,
  adminName?: string,
): Promise<WatchResult> {
  return call<WatchResult>("/watch", {
    method: "POST",
    body: JSON.stringify({ serverId, adminId, adminName }),
  });
}

export async function stopWatch(serverId: number): Promise<void> {
  await call("/stop", {
    method: "POST",
    body: JSON.stringify({ serverId }),
  }).catch(() => {});
}
