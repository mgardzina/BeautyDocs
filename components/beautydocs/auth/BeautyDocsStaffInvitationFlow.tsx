"use client";

import {
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { BeautyDocsStaffInvitation } from "../../../types/beautydocs-admin";
import { BeautyDocsWordmark } from "../BeautyDocsWordmark";
import { PasswordStrength } from "./PasswordStrength";

const inputClass =
  "w-full rounded-2xl border border-[#d4decc] bg-white px-4 py-3.5 text-sm font-semibold text-[#173d35] outline-none transition placeholder:text-stone-400 focus:border-[#245c4d] focus:ring-4 focus:ring-[#245c4d]/10 disabled:opacity-60";

export function BeautyDocsStaffInvitationFlow({
  token,
}: {
  readonly token: string | null;
}) {
  const router = useRouter();
  const [invitation, setInvitation] = useState<BeautyDocsStaffInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("Ten link zaproszenia jest nieprawidłowy.");
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/beautydocs-preview/auth/staff-invitations/${encodeURIComponent(token)}`,
          { cache: "no-store", credentials: "same-origin", signal: controller.signal },
        );
        if (!response.ok) {
          setError(
            response.status === 404
              ? "Zaproszenie wygasło, zostało już użyte albo zastąpione nowszym."
              : "Nie udało się teraz sprawdzić zaproszenia.",
          );
          return;
        }
        setInvitation((await response.json()) as BeautyDocsStaffInvitation);
      } catch (reason) {
        if ((reason as Error).name !== "AbortError") {
          setError("Nie udało się teraz sprawdzić zaproszenia.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [token]);

  const activate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !invitation) return;
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") ?? "").trim();
    const repeatedPassword = String(form.get("confirmPassword") ?? "");
    if (password !== repeatedPassword) {
      setError("Hasła nie są takie same.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/beautydocs-preview/auth/staff-invitations/${encodeURIComponent(token)}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fullName, password }),
        },
      );
      if (!response.ok) {
        setError(
          response.status === 404
            ? "Zaproszenie wygasło albo zostało już wykorzystane."
            : response.status === 409
              ? "Ten e-mail ma już konto BeautyDocs. Poproś właściciela o nowe zaproszenie na inny adres."
              : "Nie udało się aktywować konta. Sprawdź dane i spróbuj ponownie.",
        );
        return;
      }
      const session = (await response.json()) as {
        memberships?: Array<{ tenantSlug?: string }>;
      };
      const tenantSlug = session.memberships?.[0]?.tenantSlug;
      setComplete(true);
      window.setTimeout(
        () =>
          router.push(
            tenantSlug
              ? `/panel/${encodeURIComponent(tenantSlug)}`
              : "/panel",
          ),
        1300,
      );
    } catch {
      setError("Połączenie jest chwilowo niedostępne. Spróbuj ponownie.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8f4] px-4 py-10">
      <div className="w-full max-w-lg rounded-[2rem] border border-[#e5eadf] bg-white p-7 shadow-[0_24px_70px_rgba(38,65,58,0.1)] sm:p-10">
        <Link
          aria-label="BeautyDocs — strona główna"
          className="flex justify-center rounded-xl"
          href="/"
        >
          <BeautyDocsWordmark className="text-xl text-[#173d35]" />
        </Link>

        {complete ? (
          <div className="py-14 text-center" role="status">
            <span className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <Check className="size-10" strokeWidth={3} />
            </span>
            <h1 className="mt-7 font-serif text-3xl font-medium">Konto jest gotowe</h1>
            <p className="mt-3 text-sm text-stone-500">
              Przenosimy Cię do panelu salonu…
            </p>
          </div>
        ) : loading ? (
          <div className="flex min-h-80 items-center justify-center text-[#245c4d]">
            <LoaderCircle className="size-7 animate-spin" aria-label="Sprawdzanie zaproszenia" />
          </div>
        ) : invitation ? (
          <>
            <div className="mt-8 text-center">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#245c4d]">
                Zaproszenie do zespołu
              </p>
              <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight text-[#173d35]">
                Aktywuj konto pracownika
              </h1>
              <p className="mt-3 text-sm leading-6 text-stone-500">
                Konto zostanie przypisane wyłącznie do wskazanego salonu.
              </p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <InviteFact icon={Building2} label="Salon" value={invitation.salonName} />
              <InviteFact icon={Mail} label="E-mail" value={invitation.email} />
            </div>
            <form className="mt-6 space-y-5" onSubmit={activate}>
              <FormField label="Imię i nazwisko">
                <input
                  autoComplete="name"
                  className={inputClass}
                  disabled={pending}
                  maxLength={200}
                  minLength={2}
                  name="fullName"
                  placeholder="np. Anna Kowalska"
                  required
                />
              </FormField>
              <FormField label="Hasło">
                <div className="relative">
                  <input
                    autoComplete="new-password"
                    className={`${inputClass} pr-12`}
                    disabled={pending}
                    maxLength={1024}
                    minLength={8}
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimum 8 znaków"
                    required
                    type={showPassword ? "text" : "password"}
                  />
                  <button
                    aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-stone-400"
                    onClick={() => setShowPassword((value) => !value)}
                    type="button"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <PasswordStrength password={password} />
              </FormField>
              <FormField label="Powtórz hasło">
                <input
                  autoComplete="new-password"
                  className={inputClass}
                  disabled={pending}
                  maxLength={1024}
                  minLength={8}
                  name="confirmPassword"
                  placeholder="Wpisz hasło ponownie"
                  required
                  type="password"
                />
              </FormField>
              {error ? <ErrorNote>{error}</ErrorNote> : null}
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#245c4d] px-4 py-3.5 font-black text-white shadow-[0_12px_30px_rgba(36,92,77,0.18)] transition hover:bg-[#173d35] disabled:cursor-wait disabled:opacity-60"
                disabled={pending}
                type="submit"
              >
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
                {pending ? "Aktywowanie…" : "Aktywuj konto"}
                {!pending ? <ArrowRight className="size-4" /> : null}
              </button>
            </form>
          </>
        ) : (
          <div className="py-12 text-center">
            <LockKeyhole className="mx-auto size-10 text-[#245c4d]" />
            <h1 className="mt-5 font-serif text-3xl font-medium">Zaproszenie niedostępne</h1>
            {error ? <p className="mt-3 text-sm leading-6 text-stone-500">{error}</p> : null}
            <Link className="mt-6 inline-flex font-bold text-[#245c4d]" href="/konto">
              Przejdź do logowania
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-[#5a6b5a]">
        {label}
      </span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function InviteFact({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e5eadf] bg-[#f7f8f4] p-4">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#245c4d]">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-2 break-words text-sm font-bold text-[#173d35]">{value}</p>
    </div>
  );
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
      {children}
    </p>
  );
}
