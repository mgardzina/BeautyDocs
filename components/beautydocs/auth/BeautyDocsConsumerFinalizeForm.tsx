"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordStrength } from "./PasswordStrength";

const CONTROL_HEIGHT = "h-11 rounded-xl";

function PasswordField({
  id,
  name,
  placeholder,
  disabled,
  onValueChange,
}: {
  readonly id: string;
  readonly name: string;
  readonly placeholder: string;
  readonly disabled?: boolean;
  readonly onValueChange?: (value: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        autoComplete="new-password"
        className={cn(CONTROL_HEIGHT, "pr-11 text-base")}
        disabled={disabled}
        id={id}
        maxLength={1024}
        minLength={8}
        name={name}
        onChange={(event) => onValueChange?.(event.target.value)}
        placeholder={placeholder}
        required
        type={show ? "text" : "password"}
      />
      <button
        aria-label={show ? "Ukryj hasło" : "Pokaż hasło"}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={disabled}
        onClick={() => setShow((value) => !value)}
        type="button"
      >
        {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}

/**
 * Post-verification finalize card for the client (consumer) sign-up: name and
 * password create the account. No company data — clients are individuals.
 * Submits to `/api/beautydocs-preview/consumer/auth/register/complete`.
 */
export function BeautyDocsConsumerFinalizeForm({
  pending,
  error,
  email,
  password,
  onPasswordChange,
  onSubmit,
}: {
  readonly pending: boolean;
  readonly error: string | null;
  readonly email: string;
  readonly password: string;
  readonly onPasswordChange: (value: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <p className="rounded-xl bg-secondary/60 px-4 py-2.5 text-center text-sm font-medium text-primary">
          Potwierdzono: {email}
        </p>

        <Field>
          <FieldLabel htmlFor="cfin-name">Imię i nazwisko</FieldLabel>
          <Input
            autoComplete="name"
            autoFocus
            className={cn(CONTROL_HEIGHT, "text-base")}
            disabled={pending}
            id="cfin-name"
            name="fullName"
            placeholder="np. Anna Kowalska"
            required
            type="text"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="cfin-password">Hasło</FieldLabel>
          <PasswordField
            disabled={pending}
            id="cfin-password"
            name="password"
            onValueChange={onPasswordChange}
            placeholder="Minimum 8 znaków"
          />
          <PasswordStrength password={password} />
        </Field>

        <Field>
          <FieldLabel htmlFor="cfin-confirm-password">Powtórz hasło</FieldLabel>
          <PasswordField
            disabled={pending}
            id="cfin-confirm-password"
            name="confirmPassword"
            placeholder="Wpisz hasło ponownie"
          />
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
              "Tworzenie konta…"
            ) : (
              <>
                Załóż konto
                <ArrowRight aria-hidden="true" className="size-4" />
              </>
            )}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
