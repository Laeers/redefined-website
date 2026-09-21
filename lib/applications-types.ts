export type ApplicationStatus =
  | "pending"
  | "awaiting_interview"
  | "approved"
  | "rejected"
  | "changes_requested";

export interface Application {
  discordId: string;
  username: string;
  age: string;
  steamHours: string;
  realName: string;
  charName: string;
  charBackstory: string;
  rpExperience: string;
  scenario: string;
  agree: boolean;
  status: ApplicationStatus;
  staffNote?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: "Afventer behandling",
  awaiting_interview: "Afventer samtale",
  approved: "Godkendt",
  rejected: "Afvist",
  changes_requested: "Ret og send igen",
};

export const STATUS_TONE: Record<ApplicationStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  awaiting_interview: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  rejected: "border-red-500/30 bg-red-500/10 text-red-200",
  changes_requested: "border-sky-500/30 bg-sky-500/10 text-sky-200",
};
