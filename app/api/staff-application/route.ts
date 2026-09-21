import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, WHITELIST_GRANTED_ROLE_ID } from "@/lib/auth";
import { memberHasRole } from "@/lib/discord";
import {
  getStaffApplication,
  saveStaffApplication,
} from "@/lib/staff-applications";
import type {
  StaffApplication,
  StaffApplicationType,
} from "@/lib/staff-applications-types";

export const dynamic = "force-dynamic";

type Payload = {
  applicationType?: StaffApplicationType;
  age?: string;
  experience?: string;
  motivation?: string;
  availability?: string;
  strengths?: string;
  scenario?: string;
  agree?: boolean;
};

const REQUIRED_TEXT: (keyof Payload)[] = [
  "age",
  "experience",
  "motivation",
  "availability",
  "strengths",
  "scenario",
];

const VALID_TYPES: StaffApplicationType[] = [
  "whitelist_receiver",
  "general_staff",
];

function validate(body: Payload): string | null {
  if (!body.applicationType || !VALID_TYPES.includes(body.applicationType)) {
    return "Vælg en ansøgningstype";
  }
  for (const f of REQUIRED_TEXT) {
    if (!body[f] || !String(body[f]).trim()) return `Mangler felt: ${f}`;
  }
  if (!body.agree) return "Du skal acceptere betingelserne";
  return null;
}

async function readSessionUser() {
  const session = await getServerSession(authOptions);
  return session?.user as
    | {
        name?: string;
        email?: string;
        username?: string;
        discordId?: string;
        isWhitelisted?: boolean;
      }
    | undefined;
}

async function ensureWhitelisted(discordId: string, cached: boolean): Promise<boolean> {
  if (cached) return true;
  try {
    return await memberHasRole(discordId, WHITELIST_GRANTED_ROLE_ID);
  } catch {
    return false;
  }
}

export async function GET() {
  const user = await readSessionUser();
  if (!user?.discordId) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }
  const app = await getStaffApplication(user.discordId);
  return NextResponse.json({ application: app });
}

export async function POST(req: Request) {
  return upsert(req, /* allowExisting */ false);
}

export async function PUT(req: Request) {
  return upsert(req, /* allowExisting */ true);
}

async function upsert(req: Request, allowExisting: boolean) {
  const user = await readSessionUser();
  if (!user?.discordId) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const whitelisted = await ensureWhitelisted(
    user.discordId,
    Boolean(user.isWhitelisted)
  );
  if (!whitelisted) {
    return NextResponse.json(
      { error: "Du skal have whitelist-rollen for at ansøge om staff" },
      { status: 403 }
    );
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const err = validate(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const existing = await getStaffApplication(user.discordId);

  if (!allowExisting && existing && existing.status === "pending") {
    return NextResponse.json(
      {
        error:
          "Du har allerede en staff-ansøgning under behandling. Brug dashboardet for at redigere.",
      },
      { status: 409 }
    );
  }

  if (existing?.status === "approved") {
    return NextResponse.json(
      { error: "Din staff-ansøgning er allerede godkendt." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const app: StaffApplication = {
    discordId: user.discordId,
    username: user.username ?? user.name ?? "ukendt",
    applicationType: body.applicationType!,
    age: String(body.age ?? "").trim(),
    experience: String(body.experience ?? "").trim(),
    motivation: String(body.motivation ?? "").trim(),
    availability: String(body.availability ?? "").trim(),
    strengths: String(body.strengths ?? "").trim(),
    scenario: String(body.scenario ?? "").trim(),
    agree: Boolean(body.agree),
    // Eksisterende godkendte ansøgninger er allerede afvist øverst,
    // og nye / afviste indsendelser går tilbage til pending.
    status: "pending",
    staffNote: existing?.staffNote,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    revision: (existing?.revision ?? 0) + 1,
  };

  try {
    await saveStaffApplication(app);
  } catch (e) {
    console.error("[staff-application] save failed", e);
    return NextResponse.json(
      { error: "Kunne ikke gemme ansøgning" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, application: app });
}
