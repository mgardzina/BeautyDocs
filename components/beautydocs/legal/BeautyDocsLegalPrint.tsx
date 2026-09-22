"use client";

import { Printer } from "lucide-react";

export function BeautyDocsLegalPrint() {
  return (
    <button className="bd-legal-print" type="button" onClick={() => window.print()}>
      <Printer size={16} aria-hidden="true" /> Drukuj dokument
    </button>
  );
}
