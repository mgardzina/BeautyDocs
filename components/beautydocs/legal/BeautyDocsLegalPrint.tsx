"use client";

import { useT } from "../i18n";
import { Printer } from "lucide-react";

export function BeautyDocsLegalPrint() {
  const t = useT();
  return (
    <button className="bd-legal-print" type="button" onClick={() => window.print()}>
      <Printer size={16} aria-hidden="true" />{" "}{t("Drukuj dokument")}
    </button>
  );
}
