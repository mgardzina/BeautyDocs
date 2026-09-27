"use client";
import { useT } from "../../../components/beautydocs/i18n";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useT(); return <main className="bd-public-page bd-salon-empty"><h1>{t("Nie udało się wczytać salonu.")}</h1><p>{t("Spróbuj ponownie za chwilę.")}</p><button className="bd-button bd-button-primary" onClick={reset}>{t("Spróbuj ponownie")}</button></main>; }
