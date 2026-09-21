import { redirect } from "next/navigation";

export default function OldAdminWhitelistRedirect() {
  redirect("/applications/whitelist");
}
