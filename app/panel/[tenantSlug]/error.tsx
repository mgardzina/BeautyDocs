"use client";

import { BeautyDocsAdminRouteError } from "../../../components/beautydocs/admin";

export default function BeautyDocsTenantAdminError({ reset }: { readonly reset: () => void }) {
  return <BeautyDocsAdminRouteError reset={reset} />;
}
