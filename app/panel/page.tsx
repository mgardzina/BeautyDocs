import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  BeautyDocsAdminShell,
  BeautyDocsAdminUnavailable,
  BeautyDocsAccountPanel,
} from "../../components/beautydocs/admin";
import {
  fetchBeautyDocsAdminSession,
  fetchBeautyDocsMfaState,
  fetchBeautyDocsUserProfile,
} from "../../lib/beautydocs-admin-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel salonu | BeautyDocs",
  robots: { index: false, follow: false },
};

export default async function BeautyDocsAdminPreviewPage() {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");
  const [result, profile, mfa] = await Promise.all([
    fetchBeautyDocsAdminSession(cookie),
    fetchBeautyDocsUserProfile(cookie),
    fetchBeautyDocsMfaState(cookie),
  ]);

  if (
    result.status === "unauthorized" ||
    profile.status === "unauthorized" ||
    mfa.status === "unauthorized"
  ) {
    redirect("/konto");
  }
  if (result.status !== "ok" || profile.status !== "ok" || mfa.status !== "ok") {
    return <BeautyDocsAdminUnavailable />;
  }

  return (
    <BeautyDocsAdminShell user={result.data.user}>
      <BeautyDocsAccountPanel
        initialMfa={mfa.data}
        initialProfile={profile.data}
        memberships={result.data.memberships}
      />
    </BeautyDocsAdminShell>
  );
}
