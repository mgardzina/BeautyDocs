"use client";

import { PublicFormError } from "../../../../components/beautydocs/forms";

export default function PublicFormStartError({
  reset,
}: {
  readonly reset: () => void;
}) {
  return <PublicFormError reset={reset} />;
}
