"use client";

import { createContext, useContext, type ReactNode } from "react";

const ValidationContext = createContext<{ "aria-invalid"?: true; "aria-describedby"?: string }>({});
export const useFieldValidation = () => useContext(ValidationContext);

export function BeautyDocsValidatedField({ fieldKey, label, error, onTouched, className, children }: {
  readonly fieldKey: string;
  readonly label: string;
  readonly error?: string;
  readonly onTouched: (key: string) => void;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const errorId = `error-${fieldKey}`;
  const attributes = error ? { "aria-invalid": true as const, "aria-describedby": errorId } : {};
  return (
    <ValidationContext.Provider value={attributes}>
      <div
        aria-describedby={error ? errorId : undefined}
        id={`validation-${fieldKey}`}
        role="group"
        aria-label={label}
        tabIndex={-1}
        className={`min-w-0 scroll-mt-32 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] ${className ?? ""}`}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onTouched(fieldKey); }}
      >
        {children}
        {error ? <p id={errorId} className="mt-2 text-sm font-medium text-red-800" aria-live="polite">{error}</p> : null}
      </div>
    </ValidationContext.Provider>
  );
}
