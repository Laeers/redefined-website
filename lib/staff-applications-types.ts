export type StaffApplicationStatus = "pending" | "approved" | "rejected";

export type StaffApplicationType = "whitelist_receiver" | "general_staff";

export interface StaffApplication {
  discordId: string;
  username: string;
  applicationType: StaffApplicationType;
  age: string;
  experience: string;
  motivation: string;
  availability: string;
  strengths: string;
  scenario: string;
  agree: boolean;
  status: StaffApplicationStatus;
  staffNote?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export const STAFF_STATUS_LABEL: Record<StaffApplicationStatus, string> = {
  pending: "Afventer behandling",
  approved: "Godkendt",
  rejected: "Afvist",
};

export const STAFF_STATUS_TONE: Record<StaffApplicationStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  rejected: "border-red-500/30 bg-red-500/10 text-red-200",
};

export const STAFF_TYPE_LABEL: Record<StaffApplicationType, string> = {
  whitelist_receiver: "Whitelist-modtager",
  general_staff: "Almindelig staff",
};

export const STAFF_TYPE_DESCRIPTION: Record<StaffApplicationType, string> = {
  whitelist_receiver:
    "Du vil hjælpe med at behandle og vurdere whitelist-ansøgninger.",
  general_staff:
    "Du vil hjælpe med almindelig staff-arbejde — tickets, support og moderation.",
};
