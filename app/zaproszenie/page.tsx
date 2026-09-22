import type { Metadata } from "next";
import { BeautyDocsStaffInvitationFlow } from "../../components/beautydocs/auth/BeautyDocsStaffInvitationFlow";

export const metadata: Metadata = {
  title: { absolute: "Zaproszenie do zespołu — BeautyDocs" },
  description: "Jednorazowa aktywacja konta pracownika salonu BeautyDocs.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function BeautyDocsInvitationPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly token?: string }>;
}) {
  const { token } = await searchParams;
  return <BeautyDocsStaffInvitationFlow token={token ?? null} />;
}
