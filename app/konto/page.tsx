import type { Metadata } from "next";
import { BeautyDocsAuthFlow } from "../../components/beautydocs/auth/BeautyDocsAuthFlow";

export const metadata: Metadata = {
  title: { absolute: "Konto — BeautyDocs" },
  description:
    "Zaloguj się do BeautyDocs albo załóż konto właściciela salonu. Pracownicy dołączają z zaproszenia.",
  robots: { index: false, follow: false },
};

export default async function BeautyDocsKontoPreviewPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly mode?: string }>;
}) {
  const { mode } = await searchParams;
  return <BeautyDocsAuthFlow initialView={mode === "register" ? "role" : "login"} />;
}
