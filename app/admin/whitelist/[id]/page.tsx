import { redirect } from "next/navigation";

export default function OldAdminApplicationRedirect({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/applications/whitelist/${params.id}`);
}
