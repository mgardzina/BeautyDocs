"use client";

import { type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface BeautyDocsSignupFormProps {
  readonly pending: boolean;
  readonly error: string | null;
  readonly googleEnabled: boolean;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onGoogle: () => void;
  readonly onBack: () => void;
  readonly onSwitchToLogin: () => void;
  /** Optional note under the Google button (e.g. the owner's salon-name hint). */
  readonly googleHint?: string;
  readonly backLabel?: string;
}

const CONTROL_HEIGHT = "h-11 rounded-xl";

/** Colored Google glyph so the social button matches the brand rather than a mono icon. */
function GoogleGlyph({ className }: { readonly className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        fill="#4285f4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34a853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#fbbc05"
        d="M5.85 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.67-2.84Z"
      />
      <path
        fill="#ea4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.67 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

/**
 * E-mail-first registration card, built on the shadcn `signup-05` block.
 * Only the e-mail (or Google) is captured here; name, password and company
 * data are collected after e-mail verification (see BeautyDocsFinalizeForm).
 * {@link BeautyDocsAuthFlow} owns the multi-step state and the submit handler.
 */
export function BeautyDocsSignupForm({
  pending,
  error,
  googleEnabled,
  onSubmit,
  onGoogle,
  onBack,
  onSwitchToLogin,
  googleHint,
  backLabel = "Wróć",
}: BeautyDocsSignupFormProps) {
  return (
    <div className="flex flex-col gap-6">
      <button
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        disabled={pending}
        onClick={onBack}
        type="button"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {backLabel}
      </button>

      <form onSubmit={onSubmit}>
        <FieldGroup>
          {googleEnabled ? (
            <>
              <Field>
                <Button
                  className={cn(CONTROL_HEIGHT, "gap-2.5 text-sm font-semibold")}
                  disabled={pending}
                  onClick={onGoogle}
                  type="button"
                  variant="outline"
                >
                  <GoogleGlyph className="size-5" />
                  Kontynuuj z Google
                </Button>
                {googleHint ? (
                  <FieldDescription className="text-center">
                    {googleHint}
                  </FieldDescription>
                ) : null}
              </Field>
              <FieldSeparator>lub użyj e-maila</FieldSeparator>
            </>
          ) : null}

          <Field>
            <FieldLabel htmlFor="reg-email">Adres e-mail</FieldLabel>
            <Input
              autoComplete="email"
              autoFocus
              className={cn(CONTROL_HEIGHT, "text-base")}
              disabled={pending}
              id="reg-email"
              name="email"
              placeholder="twoj@email.pl"
              required
              type="email"
            />
            <FieldDescription>
              Wyślemy 6-cyfrowy kod, aby potwierdzić, że to Twój adres.
            </FieldDescription>
          </Field>

          {error ? (
            <p
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <Field>
            <Button
              className={cn(CONTROL_HEIGHT, "gap-2 text-sm font-semibold")}
              disabled={pending}
              type="submit"
            >
              {pending ? (
                "Wysyłanie kodu…"
              ) : (
                <>
                  Dalej
                  <ArrowRight aria-hidden="true" className="size-4" />
                </>
              )}
            </Button>
          </Field>

          <FieldDescription className="text-center">
            Masz już konto?{" "}
            <button
              className="font-semibold text-primary underline-offset-4 transition hover:underline"
              onClick={onSwitchToLogin}
              type="button"
            >
              Zaloguj się
            </button>
          </FieldDescription>
        </FieldGroup>
      </form>

      <FieldDescription className="px-6 text-center">
        Zakładając konto, akceptujesz nasz{" "}
        <Link href="/regulamin">Regulamin</Link> oraz{" "}
        <Link href="/polityka-prywatnosci">Politykę prywatności</Link>.
      </FieldDescription>
    </div>
  );
}
