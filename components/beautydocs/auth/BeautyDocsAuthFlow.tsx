"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { BeautyDocsWordmark } from "../BeautyDocsWordmark";
import { BeautyDocsCodeInput } from "./BeautyDocsCodeInput";
import { BeautyDocsEmailVerifyGate } from "./BeautyDocsEmailVerifyGate";
import { BeautyDocsLockedPanelCard } from "./BeautyDocsLockedPanelCard";
import { BeautyDocsSignupForm } from "./BeautyDocsSignupForm";
import { BeautyDocsFinalizeForm } from "./BeautyDocsFinalizeForm";
import {
  BeautyDocsCompanyFields,
  EMPTY_COMPANY_CONFIGURATION,
  type CompanyConfigurationForm,
} from "./BeautyDocsCompanyFields";
import type { BeautyDocsMfaLoginChallenge } from "../../../types/beautydocs-admin";
import {
  formatPolishNipInput,
  isValidPolishNip,
  normalizePolishNip,
} from "../../../lib/polish-nip";

type View =
  | "login"
  | "loggedIn"
  | "mfa"
  | "role"
  | "register"
  | "googleSalon"
  | "forgot"
  | "sent"
  | "verify"
  | "finalize"
  | "configure"
  | "done";

const MotionLink = motion.create(Link);

const PANEL_PATH = "/panel";
const CLIENT_PANEL_PATH = "/klient";
const HOME_PATH = "/";

const inputCls =
  "w-full rounded-2xl border border-[#d4decc] bg-white px-4 py-3.5 text-xs font-black leading-4 text-[#173d35] outline-none transition placeholder:text-[#aeb3a7] focus:border-[#245c4d] focus:ring-4 focus:ring-[#245c4d]/10 disabled:opacity-60";

interface PostResult {
  readonly ok: boolean;
  readonly status: number;
  readonly code: string | null;
  readonly data: Record<string, unknown> | null;
}

interface GoogleLoginConfig {
  readonly enabled: boolean;
  readonly clientId: string | null;
}

async function postJson(url: string, body: unknown): Promise<PostResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    let data: Record<string, unknown> | null = null;
    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      data = null;
    }
    const errorBlock = data?.error as { code?: unknown } | undefined;
    const code = typeof errorBlock?.code === "string" ? errorBlock.code : null;
    return { ok: response.ok, status: response.status, code, data };
  } catch {
    return { ok: false, status: 0, code: null, data: null };
  }
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  readonly label: string;
  readonly htmlFor?: string;
  readonly hint?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label
          className="block text-xs font-black uppercase tracking-[0.14em] text-[#5a6b5a]"
          htmlFor={htmlFor}
        >
          {label}
        </label>
        {hint}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function PrimaryButton({
  children,
  pending = false,
  pendingLabel = "Chwileczkę…",
}: {
  readonly children: ReactNode;
  readonly pending?: boolean;
  readonly pendingLabel?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#245c4d] px-4 py-3.5 font-black text-white shadow-[0_12px_30px_rgba(36,92,77,0.18)] transition-colors hover:bg-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
      disabled={pending}
      transition={{ type: "spring", bounce: 0, duration: 0.2 }}
      type="submit"
      whileHover={reduceMotion || pending ? undefined : { y: -2 }}
      whileTap={reduceMotion || pending ? undefined : { scale: 0.97 }}
    >
      {pending ? pendingLabel : children}
    </motion.button>
  );
}

function ErrorNote({ message }: { readonly message: string | null }) {
  if (!message) return null;
  return (
    <p
      className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      role="alert"
    >
      {message}
    </p>
  );
}

function PasswordInput({
  id,
  name,
  disabled = false,
  placeholder = "••••••••",
  autoComplete = "current-password",
  minLength,
  onValueChange,
}: {
  readonly id: string;
  readonly name: string;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly autoComplete?: string;
  readonly minLength?: number;
  readonly onValueChange?: (value: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        autoComplete={autoComplete}
        className={`${inputCls} pr-12`}
        disabled={disabled}
        id={id}
        maxLength={1024}
        minLength={minLength}
        name={name}
        onChange={(event) => onValueChange?.(event.target.value)}
        placeholder={placeholder}
        required
        type={show ? "text" : "password"}
      />
      <button
        aria-label={show ? "Ukryj hasło" : "Pokaż hasło"}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#8ea591] transition hover:text-[#245c4d] focus-visible:outline-none"
        onClick={() => setShow((v) => !v)}
        type="button"
      >
        {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}

const SWITCH_LINK =
  "font-bold text-[#245c4d] underline-offset-4 transition hover:text-[#173d35] hover:underline focus-visible:outline-none";

export function BeautyDocsAuthFlow({
  initialView = "login",
}: {
  readonly initialView?: "login" | "role";
}) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const stepTransition = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15, ease: "easeOut" as const },
      }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { type: "spring" as const, bounce: 0, duration: 0.35 },
      };
  const [view, setViewState] = useState<View>(initialView);
  const [email, setEmail] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  // One-time token returned by e-mail verification; authorizes the finalize step.
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  const [mfaChallenge, setMfaChallenge] =
    useState<BeautyDocsMfaLoginChallenge | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleConfig, setGoogleConfig] = useState<GoogleLoginConfig | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [registrationPassword, setRegistrationPassword] = useState("");
  const [companyConfiguration, setCompanyConfiguration] =
    useState<CompanyConfigurationForm>(EMPTY_COMPANY_CONFIGURATION);
  const [companyLookupPending, setCompanyLookupPending] = useState(false);
  const [companyLookupNote, setCompanyLookupNote] = useState<string | null>(null);
  const googleTokenClientRef = useRef<GoogleTokenClient | null>(null);
  const googleIntentRef = useRef<"login" | "register">("login");
  // Holds the Google ID token between "Kontynuuj z Google" and the salon-name step.
  const [googleOwnerCredential, setGoogleOwnerCredential] = useState<
    string | null
  >(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(
          "/api/beautydocs-preview/auth/google/config",
          { cache: "no-store", credentials: "same-origin" },
        );
        if (response.ok) {
          setGoogleConfig((await response.json()) as GoogleLoginConfig);
        }
      } catch {
        // Classic e-mail registration remains available when Google is offline.
      }
    })();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [view]);

  const handleLoginGoogle = useCallback(
    async (accessToken: string) => {
      setPending(true);
      setError(null);
      try {
        const resolved = await fetch(
          "/api/beautydocs-preview/auth/google/resolve",
          {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ accessToken }),
          },
        );
        let target: "staff" | "consumer" | "none" = "none";
        if (resolved.ok) {
          const body = (await resolved.json()) as { target?: unknown };
          if (body.target === "staff" || body.target === "consumer") {
            target = body.target;
          }
        } else {
          setError(
            "Nie udało się zalogować przez Google. Spróbuj ponownie lub użyj hasła.",
          );
          return;
        }

        const endpoint =
          target === "staff"
            ? "/api/beautydocs-preview/auth/google/staff"
            : "/api/beautydocs-preview/consumer/auth/google";
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
        if (!response.ok) {
          setError(
            response.status === 409
              ? "To konto Google jest już połączone z innym kontem BeautyDocs."
              : "Nie udało się zalogować przez Google. Spróbuj ponownie lub użyj hasła.",
          );
          return;
        }
        if (target === "staff") {
          const data = (await response.json()) as Record<string, unknown>;
          if (data.mfaRequired === true) {
            setMfaChallenge(data as unknown as BeautyDocsMfaLoginChallenge);
            setMfaCode("");
            setViewState("mfa");
            return;
          }
          setViewState("loggedIn");
          router.push(PANEL_PATH);
        } else {
          router.push(CLIENT_PANEL_PATH);
        }
      } catch {
        setError(
          "Google jest chwilowo niedostępne. Nadal możesz zalogować się e-mailem i hasłem.",
        );
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  // Google authenticates first; the salon name is collected in the next step.
  const handleRegisterGoogle = useCallback((accessToken: string) => {
    setGoogleOwnerCredential(accessToken);
    setError(null);
    setViewState("googleSalon");
  }, []);

  const handleGoogleSalonSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!googleOwnerCredential) {
      setError("Sesja Google wygasła. Zacznij zakładanie konta od nowa.");
      setViewState("register");
      return;
    }
    const salonName = String(
      new FormData(e.currentTarget).get("salonName") ?? "",
    ).trim();
    if (salonName.length === 0) {
      setError("Podaj nazwę salonu.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/beautydocs-preview/auth/google/register-owner",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accessToken: googleOwnerCredential, salonName }),
        },
      );
      if (!response.ok) {
        setError(
          response.status === 409
            ? "To konto Google ma już konto w BeautyDocs. Zaloguj się zamiast zakładać nowe."
            : "Nie udało się założyć konta przez Google. Spróbuj ponownie lub użyj e-maila.",
        );
        return;
      }
      setGoogleOwnerCredential(null);
      // Account + session created; now collect company data (NIP/GUS/address)
      // via the same step the e-mail flow uses.
      setViewState("configure");
    } catch {
      setError(
        "Google jest chwilowo niedostępne. Nadal możesz założyć konto e-mailem.",
      );
    } finally {
      setPending(false);
    }
  };

  // Build one OAuth token client; a ref decides whether the returned access
  // token drives login or owner registration. This backs our fully custom
  // Google buttons (the native GIS button can't be restyled).
  useEffect(() => {
    const clientId = googleConfig?.enabled ? googleConfig.clientId : null;
    const oauth2 = window.google?.accounts?.oauth2;
    if (!googleReady || !oauth2 || !clientId) return;
    googleTokenClientRef.current = oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      error_callback: () => setError("Okno Google zostało zamknięte lub zablokowane. Spróbuj ponownie albo użyj e-maila."),
      callback: (response) => {
        if (!response.access_token) {
          setError(
            "Nie udało się połączyć z Google. Spróbuj ponownie lub użyj e-maila.",
          );
          return;
        }
        if (googleIntentRef.current === "register") {
          handleRegisterGoogle(response.access_token);
        } else {
          void handleLoginGoogle(response.access_token);
        }
      },
    });
  }, [googleConfig, googleReady, handleLoginGoogle, handleRegisterGoogle]);

  const requestGoogle = (intent: "login" | "register") => {
    const client = googleTokenClientRef.current;
    if (!client) {
      setError(googleConfig?.enabled ? "Nie udało się uruchomić Google. Odśwież stronę lub użyj e-maila." : "Logowanie Google jest chwilowo niedostępne. Użyj adresu e-mail.");
      return;
    }
    googleIntentRef.current = intent;
    setError(null);
    client.requestAccessToken();
  };

  const setView = (v: View) => (e?: SyntheticEvent) => {
    e?.preventDefault();
    setError(null);
    setViewState(v);
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setPending(true);
    setError(null);

    // 1. Rozpoznaj konto klientki (nie ma lockoutu, więc bezpieczne jako pierwsze).
    const client = await postJson(
      "/api/beautydocs-preview/consumer/auth/password",
      { email, password },
    );
    if (client.ok) {
      setPending(false);
      router.push(CLIENT_PANEL_PATH);
      return;
    }
    if (client.status === 403) {
      setPending(false);
      setError(
        "Potwierdź adres e-mail kodem z rejestracji, zanim się zalogujesz.",
      );
      return;
    }

    // 2. W przeciwnym razie spróbuj konta salonu (personel/właściciel).
    const staff = await postJson("/api/beautydocs-preview/auth/login", {
      email,
      password,
    });
    setPending(false);
    if (staff.ok) {
      if (staff.data?.mfaRequired === true) {
        setMfaChallenge(staff.data as unknown as BeautyDocsMfaLoginChallenge);
        setMfaCode("");
        setViewState("mfa");
        return;
      }
      setViewState("loggedIn");
      router.push(PANEL_PATH);
      return;
    }
    setError(
      staff.status === 401
        ? "Nieprawidłowy adres e-mail lub hasło."
        : "Logowanie jest chwilowo niedostępne. Spróbuj ponownie.",
    );
  };

  const handleMfaConfirm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mfaChallenge || mfaCode.length !== 6) {
      setError("Wpisz pełny 6-cyfrowy kod.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await postJson(
      "/api/beautydocs-preview/auth/mfa/login/confirm",
      { challengeId: mfaChallenge.challengeId, code: mfaCode },
    );
    setPending(false);
    if (result.ok) {
      setViewState("loggedIn");
      router.push(PANEL_PATH);
      return;
    }
    setError(
      result.status === 400
        ? "Kod jest nieprawidłowy lub wygasł."
        : "Weryfikacja jest chwilowo niedostępna. Spróbuj ponownie.",
    );
  };

  // Step 1 of the e-mail flow: capture only the e-mail and send a code.
  const [resent, setResent] = useState(false);
  const [resendUntil, setResendUntil] = useState(0);
  const [resendWaiting, setResendWaiting] = useState(false);
  useEffect(() => {
    if (!resendUntil) return;
    const timer = setTimeout(() => setResendWaiting(false), Math.max(0, resendUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [resendUntil]);
  const resendCode = async () => {
    if (pending || Date.now() < resendUntil) return;
    setPending(true); setError(null); setResent(false);
    const result = await postJson("/api/beautydocs-preview/auth/register", { email });
    setPending(false);
    if (!result.ok) { setError("Nie udało się wysłać kodu. Spróbuj ponownie za chwilę."); return; }
    setDevCode(typeof result.data?.devCode === "string" ? result.data.devCode : null);
    setCode(""); setResent(true); setResendWaiting(true); setResendUntil(Date.now() + 60_000);
  };

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    const submittedEmail = String(form.get("email") ?? "").trim();
    const result = await postJson("/api/beautydocs-preview/auth/register", {
      email: submittedEmail,
    });
    setPending(false);
    if (result.ok) {
      setEmail(submittedEmail);
      setDevCode(typeof result.data?.devCode === "string" ? result.data.devCode : null);
      setCode("");
      setRegistrationToken(null);
      setRegistrationPassword("");
      setCompanyConfiguration(EMPTY_COMPANY_CONFIGURATION);
      setViewState("verify");
      return;
    }
    setError(
      result.code === "email_taken"
        ? "Ten adres e-mail jest już zarejestrowany."
        : "Rejestracja jest chwilowo niedostępna. Spróbuj ponownie.",
    );
  };

  // Step 2: confirm the e-mail; the token authorizes the finalize step.
  const handleVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Wpisz pełny 6-cyfrowy kod.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await postJson("/api/beautydocs-preview/auth/register/verify", {
      email,
      code,
    });
    setPending(false);
    if (result.ok) {
      setRegistrationToken(
        typeof result.data?.registrationToken === "string"
          ? result.data.registrationToken
          : null,
      );
      setViewState("finalize");
      return;
    }
    setError(
      result.code === "invalid_code"
        ? "Nieprawidłowy lub wygasły kod. Spróbuj ponownie."
        : "Weryfikacja jest chwilowo niedostępna. Spróbuj ponownie.",
    );
  };

  // Step 3 (e-mail flow): personal data, password and company data create the
  // account and log the owner in.
  const handleComplete = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    const password = String(form.get("password") ?? "");
    const repeatedPassword = String(form.get("confirmPassword") ?? "");
    if (password !== repeatedPassword) {
      setError("Hasła nie są takie same.");
      return;
    }
    if (password.length < 8) {
      setError("Hasło musi mieć co najmniej 8 znaków.");
      return;
    }
    if (!isValidPolishNip(companyConfiguration.nip)) {
      setError("NIP musi zawierać 10 cyfr i mieć poprawną sumę kontrolną.");
      return;
    }
    if (registrationToken === null) {
      setError("Sesja rejestracji wygasła. Zacznij zakładanie konta od nowa.");
      setViewState("register");
      return;
    }
    setPending(true);
    const result = await postJson(
      "/api/beautydocs-preview/auth/register/complete",
      {
        registrationToken,
        fullName: String(form.get("fullName") ?? "").trim(),
        salonName: String(form.get("salonName") ?? "").trim(),
        password,
        nip: normalizePolishNip(companyConfiguration.nip),
        regon: companyConfiguration.regon.trim() || null,
        krs: companyConfiguration.krs.trim() || null,
        companyName: companyConfiguration.companyName.trim(),
        street: companyConfiguration.street.trim(),
        postalCode: companyConfiguration.postalCode.trim(),
        city: companyConfiguration.city.trim(),
      },
    );
    setPending(false);
    if (result.ok) {
      setViewState("done");
      return;
    }
    setError(
      result.code === "email_taken"
        ? "Ten adres e-mail jest już zarejestrowany. Zaloguj się zamiast zakładać nowe konto."
        : result.code === "invalid_registration"
          ? "Sesja rejestracji wygasła. Zacznij zakładanie konta od nowa."
          : result.status === 422
            ? "Sprawdź dane firmy — część pól ma nieprawidłowy format."
            : "Zapis jest chwilowo niedostępny. Spróbuj ponownie.",
    );
  };

  const handleConfigure = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValidPolishNip(companyConfiguration.nip)) {
      setError("NIP musi zawierać 10 cyfr i mieć poprawną sumę kontrolną.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await postJson("/api/beautydocs-preview/auth/configure", {
      nip: normalizePolishNip(companyConfiguration.nip),
      regon: companyConfiguration.regon.trim() || null,
      krs: companyConfiguration.krs.trim() || null,
      companyName: companyConfiguration.companyName.trim(),
      street: companyConfiguration.street.trim(),
      postalCode: companyConfiguration.postalCode.trim(),
      city: companyConfiguration.city.trim(),
    });
    if (result.ok) {
      setPending(false);
      setViewState("done");
      return;
    }
    setPending(false);
    setError(
      result.status === 401
        ? "Sesja wygasła. Zaloguj się ponownie."
        : result.status === 422
          ? "Sprawdź NIP, REGON, KRS i adres firmy. Część danych ma nieprawidłowy format."
        : "Zapis jest chwilowo niedostępny. Spróbuj ponownie.",
    );
  };

  const updateCompanyConfiguration = (
    field: keyof CompanyConfigurationForm,
    value: string,
  ) => {
    setCompanyConfiguration((current) => ({ ...current, [field]: value }));
    setCompanyLookupNote(null);
  };

  const handleCompanyLookup = async () => {
    if (!isValidPolishNip(companyConfiguration.nip)) {
      setError("NIP musi zawierać 10 cyfr i mieć poprawną sumę kontrolną.");
      setCompanyLookupNote(null);
      return;
    }

    setCompanyLookupPending(true);
    setError(null);
    setCompanyLookupNote(null);
    const result = await postJson(
      "/api/beautydocs-preview/auth/company-lookup",
      { nip: normalizePolishNip(companyConfiguration.nip) },
    );
    setCompanyLookupPending(false);

    if (!result.ok || result.data === null) {
      setError(
        result.status === 404
          ? "GUS nie znalazł podmiotu o podanym numerze NIP."
          : result.status === 422
            ? "NIP ma nieprawidłowy format lub sumę kontrolną."
            : "Nie udało się teraz pobrać danych z GUS. Możesz uzupełnić je ręcznie.",
      );
      return;
    }

    const data = result.data;
    const textValue = (key: string) =>
      typeof data[key] === "string" ? String(data[key]) : "";
    setCompanyConfiguration({
      nip: formatPolishNipInput(textValue("nip")),
      regon: textValue("regon"),
      krs: textValue("krs"),
      companyName: textValue("companyName"),
      street: textValue("street"),
      postalCode: textValue("postalCode"),
      city: textValue("city"),
    });

    const status = textValue("statusNip");
    const endedAt = textValue("activityEndedAt");
    if (endedAt) {
      setError(
        `Dane pobrano z GUS, ale rejestr wskazuje zakończenie działalności: ${endedAt}.`,
      );
    } else {
      setCompanyLookupNote(
        `Dane potwierdzone w GUS${status ? ` · status NIP: ${status}` : ""}.`,
      );
    }
  };

  const heading = useMemo(() => {
    switch (view) {
      case "login":
        return { eyebrow: "Miło Cię widzieć", title: "Witaj ponownie" };
      case "loggedIn":
        return { eyebrow: "", title: "" };
      case "mfa":
        return { eyebrow: "Dodatkowe zabezpieczenie", title: "Potwierdź logowanie" };
      case "role":
        return { eyebrow: "Nowe konto", title: "Jak chcesz korzystać z BeautyDocs?" };
      case "register":
        return { eyebrow: "Konto właściciela", title: "Załóż konto salonu" };
      case "googleSalon":
        return { eyebrow: "Ostatni krok", title: "Nazwa Twojego salonu" };
      case "forgot":
      case "sent":
        return { eyebrow: "Odzyskiwanie", title: "Nie pamiętasz hasła?" };
      case "verify":
        return { eyebrow: "Krok 1 z 2", title: "Potwierdź e-mail" };
      case "finalize":
        return { eyebrow: "Krok 2 z 2", title: "Dokończ zakładanie konta" };
      case "configure":
        return { eyebrow: "Ostatni krok", title: "Dane firmowe salonu" };
      case "done":
        return { eyebrow: "Gotowe", title: "Konto jest gotowe" };
    }
  }, [view]);

  if (view === "verify") {
    return (
      <BeautyDocsEmailVerifyGate
        code={code}
        devCode={devCode}
        email={email}
        error={error}
        onChangeEmail={setView("register")}
        onCodeChange={setCode}
        onResend={resendCode}
        onSubmit={handleVerify}
        pending={pending}
        resendWaiting={resendWaiting}
        resent={resent}
        variant="owner"
      />
    );
  }

  if (
    view === "finalize" ||
    view === "googleSalon" ||
    view === "configure" ||
    view === "done"
  ) {
    return (
      <BeautyDocsLockedPanelCard
        maxWidthClassName={view === "finalize" || view === "configure" ? "max-w-xl" : "max-w-md"}
        variant="owner"
      >
        <div className="p-6 sm:p-8">
          {view === "finalize" ? (
            <p className="bd-auth-verified" role="status">
              <Check size={17} aria-hidden="true" /> Adres e-mail potwierdzony
            </p>
          ) : null}
          {view !== "done" ? (
            <>
              <p className="text-center text-xs font-black uppercase tracking-[0.18em] text-[#426447]">
                {heading.eyebrow}
              </p>
              <h1 className="mt-2 text-center font-serif text-3xl font-medium tracking-tight text-[#173d35] sm:text-4xl">
                {heading.title}
              </h1>
            </>
          ) : null}

          <div className={view === "done" ? "" : "mt-8"}>
            {view === "finalize" ? (
              <BeautyDocsFinalizeForm
                company={companyConfiguration}
                companyLookupNote={companyLookupNote}
                companyLookupPending={companyLookupPending}
                email={email}
                error={error}
                onCompanyChange={updateCompanyConfiguration}
                onCompanyLookup={() => void handleCompanyLookup()}
                onPasswordChange={setRegistrationPassword}
                onSubmit={handleComplete}
                password={registrationPassword}
                pending={pending}
              />
            ) : null}

            {view === "googleSalon" ? (
              <form className="space-y-5" onSubmit={handleGoogleSalonSubmit}>
                <button
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-[#245c4d] transition hover:text-[#173d35]"
                  onClick={setView("register")}
                  type="button"
                >
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Wróć
                </button>
                <p className="text-sm text-stone-600">
                  Zweryfikowaliśmy Twoje konto Google. Podaj nazwę salonu, aby
                  dokończyć zakładanie konta.
                </p>
                <Field htmlFor="gs-salon" label="Nazwa salonu">
                  <input
                    autoFocus
                    className={inputCls}
                    disabled={pending}
                    id="gs-salon"
                    name="salonName"
                    placeholder="np. Studio Lumière"
                    required
                    type="text"
                  />
                </Field>
                <ErrorNote message={error} />
                <PrimaryButton pending={pending} pendingLabel="Zakładanie konta…">
                  Załóż salon
                  <ArrowRight aria-hidden="true" className="size-4" />
                </PrimaryButton>
              </form>
            ) : null}

            {view === "configure" ? (
              <form className="space-y-5" onSubmit={handleConfigure}>
                <p className="text-stone-600">
                  Uzupełnij dane firmowe salonu — użyjemy ich w formularzach i
                  klauzulach informacyjnych.
                </p>
                <BeautyDocsCompanyFields
                  company={companyConfiguration}
                  disabled={pending}
                  lookupNote={companyLookupNote}
                  lookupPending={companyLookupPending}
                  onChange={updateCompanyConfiguration}
                  onLookup={() => void handleCompanyLookup()}
                />
                <ErrorNote message={error} />
                <PrimaryButton pending={pending || companyLookupPending} pendingLabel={companyLookupPending ? "Pobieranie z GUS…" : "Zapisywanie…"}>
                  Zakończ konfigurację
                  <ArrowRight aria-hidden="true" className="size-4" />
                </PrimaryButton>
              </form>
            ) : null}

            {view === "done" ? (
              <div className="space-y-6 text-center">
                <SuccessIcon />
                <p className="text-lg font-black text-[#173d35]">Konto jest gotowe</p>
                <p className="text-stone-600">
                  Wszystko gotowe! Twój salon jest skonfigurowany — możesz przejść do
                  panelu i zacząć zbierać dokumentację online.
                </p>
                <Link
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#245c4d] px-4 py-3.5 font-black text-white shadow-[0_12px_30px_rgba(36,92,77,0.18)] transition hover:-translate-y-0.5 hover:bg-[#173d35]"
                  href={PANEL_PATH}
                >
                  Przejdź do panelu
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </BeautyDocsLockedPanelCard>
    );
  }

  return (
    <div className="bd-auth-page" data-view={view}>
      {googleConfig?.enabled ? (
        <Script
          onError={() => setGoogleReady(false)}
          onLoad={() => setGoogleReady(true)}
          onReady={() => setGoogleReady(true)}
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />
      ) : null}
      <header className="bd-auth-header"><Link href="/" aria-label="BeautyDocs — strona główna"><span aria-hidden="true">✳</span><BeautyDocsWordmark /></Link><Link href="/kontakt">Potrzebujesz pomocy? <ArrowRight size={15} aria-hidden="true" /></Link></header>
      <main className="bd-auth-layout">
        <aside className="bd-auth-story"><p className="bd-eyebrow">Twoje miejsce w BeautyDocs</p><h2>Dobry dzień.<br /><span className="bd-serif">Zaczyna się tutaj.</span></h2><p>Dokumentacja, klientki i Twój zespół.<br />Wszystko blisko. Wszystko na swoim miejscu.</p></aside>
        <div className="bd-auth-card">
          <Link
            aria-label="BeautyDocs — strona główna"
            className="bd-auth-card-brand"
            href={HOME_PATH}
          >
            <BeautyDocsWordmark className="text-xl text-[#173d35]" />
          </Link>

          <AnimatePresence initial={false} mode="wait">
            <motion.div
              animate={stepTransition.animate}
              exit={stepTransition.exit}
              initial={stepTransition.initial}
              key={view}
              transition={stepTransition.transition}
            >
          {view !== "loggedIn" ? (
            <>
              <p className="text-center text-xs font-black uppercase tracking-[0.18em] text-[#426447]">
                {heading.eyebrow}
              </p>
              <h1 className="mt-2 text-center font-serif text-3xl font-medium tracking-tight text-[#173d35] sm:text-4xl">
                {heading.title}
              </h1>
            </>
          ) : null}

          <div className={view === "loggedIn" ? "" : "mt-8"}>
            {view === "loggedIn" ? (
              <div className="flex min-h-[460px] flex-col items-center justify-center text-center">
                <div className="relative flex items-center justify-center">
                  <span
                    aria-hidden="true"
                    className="bd-ring absolute size-20 rounded-full bg-[#3b6d11]/20"
                  />
                  <span className="bd-pop relative flex size-20 items-center justify-center rounded-full bg-[#eaf3de] text-[#3b6d11]">
                    <Check aria-hidden="true" className="size-10" strokeWidth={3} />
                  </span>
                </div>
                <h1 className="mt-8 font-serif text-3xl font-medium tracking-tight text-[#173d35] sm:text-4xl">
                  Zalogowano!
                </h1>
                <p className="mt-3 text-stone-600">Przenosimy Cię do panelu…</p>
              </div>
            ) : null}
            {view === "mfa" && mfaChallenge ? (
              <form className="space-y-6" onSubmit={handleMfaConfirm}>
                <div className="rounded-2xl border border-[#dce3d5] bg-[#f0f4e9] p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#e4ecd8] text-[#245c4d]">
                      <ShieldCheck className="size-5" />
                    </span>
                    <div>
                      <p className="font-black text-[#173d35]">
                        {mfaChallenge.method === "SMS"
                          ? "Kod został wysłany SMS-em"
                          : "Otwórz aplikację uwierzytelniającą"}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-stone-500">
                        {mfaChallenge.method === "SMS"
                          ? `Wpisz kod wysłany na ${mfaChallenge.destinationMasked ?? "zweryfikowany numer telefonu"}.`
                          : "Wpisz aktualny kod z Google Authenticator lub innej połączonej aplikacji."}
                      </p>
                    </div>
                  </div>
                </div>

                <BeautyDocsCodeInput
                  disabled={pending}
                  onChange={setMfaCode}
                  value={mfaCode}
                />

                {mfaChallenge.devCode ? (
                  <p className="rounded-xl bg-[#eaf0e2] px-3 py-2 text-center text-xs text-[#426447]">
                    Tryb lokalny — kod: {" "}
                    <span className="font-black tracking-widest">
                      {mfaChallenge.devCode}
                    </span>
                  </p>
                ) : null}

                <ErrorNote message={error} />
                <PrimaryButton pending={pending} pendingLabel="Sprawdzanie kodu…">
                  Potwierdź logowanie
                  <ArrowRight aria-hidden="true" className="size-4" />
                </PrimaryButton>
                <button
                  className="mx-auto block text-sm font-bold text-[#245c4d]"
                  onClick={() => {
                    setMfaChallenge(null);
                    setMfaCode("");
                    setError(null);
                    setViewState("login");
                  }}
                  type="button"
                >
                  Wróć do logowania
                </button>
              </form>
            ) : null}
            {view === "login" ? (
              <form className="space-y-5" onSubmit={handleLogin}>
                {googleConfig?.enabled ? (
                  <div>
                    <GoogleAuthButton
                      disabled={pending}
                      label="Zaloguj się przez Google"
                      onClick={() => requestGoogle("login")}
                    />
                    <div className="mt-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-stone-400">
                      <span className="h-px flex-1 bg-stone-200" />
                      lub zaloguj się e-mailem
                      <span className="h-px flex-1 bg-stone-200" />
                    </div>
                  </div>
                ) : null}
                <Field htmlFor="login-email" label="Adres e-mail">
                  <input
                    autoComplete="username"
                    className={inputCls}
                    disabled={pending}
                    id="login-email"
                    name="email"
                    placeholder="twoj@email.pl"
                    required
                    type="email"
                  />
                </Field>
                <Field
                  htmlFor="login-password"
                  label="Hasło"
                  hint={
                    <button className={`text-xs ${SWITCH_LINK}`} onClick={setView("forgot")} type="button">
                      Nie pamiętasz?
                    </button>
                  }
                >
                  <PasswordInput
                    autoComplete="current-password"
                    disabled={pending}
                    id="login-password"
                    name="password"
                  />
                </Field>
                <ErrorNote message={error} />
                <PrimaryButton pending={pending} pendingLabel="Logowanie…">
                  Zaloguj się
                  <ArrowRight aria-hidden="true" className="size-4" />
                </PrimaryButton>
                <p className="text-center text-sm text-stone-600">
                  Nie masz konta?{" "}
                  <button className={SWITCH_LINK} onClick={setView("role")} type="button">
                    Załóż konto
                  </button>
                </p>
              </form>
            ) : null}

            {view === "role" ? (
              <div className="space-y-4">
                <RoleChoice
                  description="Wypełniaj formularze szybciej i miej dostęp do swoich dokumentów."
                  href="/klient"
                  icon={<UserRound aria-hidden="true" className="size-5" />}
                  title="Jestem klientką / klientem"
                />
                <RoleChoice
                  description="Załóż salon i zapraszaj swój zespół."
                  icon={<Building2 aria-hidden="true" className="size-5" />}
                  onClick={() => {
                    setRegistrationPassword("");
                    setError(null);
                    setViewState("register");
                  }}
                  title="Jestem właścicielem salonu"
                />
                <BackToLogin onClick={setView("login")} />
              </div>
            ) : null}

            {view === "register" ? (
              <BeautyDocsSignupForm
                error={error}
                googleEnabled={googleConfig?.enabled ?? false}
                googleHint="Nazwę salonu podasz w następnym kroku."
                onBack={setView("role")}
                onGoogle={() => requestGoogle("register")}
                onSubmit={handleRegister}
                onSwitchToLogin={setView("login")}
                pending={pending}
              />
            ) : null}

            {view === "forgot" ? (
              <div className="space-y-5">
                <p className="text-sm leading-7 text-stone-600">Automatyczny reset hasła jest chwilowo niedostępny. Skontaktuj się z nami, aby uzyskać pomoc z dostępem do konta.</p>
                <Link className="bd-button bd-button-primary w-full" href="/kontakt">Kontakt z pomocą <ArrowRight size={16} aria-hidden="true" /></Link>
                <BackToLogin onClick={setView("login")} />
              </div>
            ) : null}

            {view === "sent" ? (
              <div className="space-y-6">
                <SuccessIcon />
                <p className="text-stone-600">
                  Jeśli konto istnieje, wysłaliśmy link do zresetowania hasła.
                  Sprawdź skrzynkę (także folder spam).
                </p>
                <BackToLogin onClick={setView("login")} />
              </div>
            ) : null}

          </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <footer className="bd-auth-footer"><span>© {new Date().getFullYear()} BeautyDocs</span><Link href="/polityka-prywatnosci">Prywatność</Link><Link href="/regulamin">Regulamin</Link></footer>
    </div>
  );
}

function GoogleGlyph({ className = "" }: { readonly className?: string }) {
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

/** Fully custom Google button (OAuth token flow) — matches the app UI. */
function GoogleAuthButton({
  label,
  onClick,
  disabled,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-[#d4decc] bg-white px-4 text-sm font-black text-[#173d35] shadow-[0_1px_2px_rgba(38,65,58,0.04)] transition-colors hover:border-[#b8cbaa] hover:bg-[#f8faf4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2 disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      transition={{ type: "spring", bounce: 0, duration: 0.2 }}
      type="button"
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.97 }}
    >
      <GoogleGlyph className="size-5 shrink-0" />
      {label}
    </motion.button>
  );
}

function RoleChoice({
  title,
  description,
  icon,
  href,
  onClick,
}: {
  readonly title: string;
  readonly description: string;
  readonly icon: ReactNode;
  readonly href?: string;
  readonly onClick?: () => void;
}) {
  const content = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#e4ecd8] text-[#245c4d]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-black text-[#173d35]">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-stone-600">{description}</span>
      </span>
      <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-[#245c4d]" />
    </>
  );
  const className =
    "flex w-full items-center gap-4 rounded-2xl border border-[#d4decc] bg-white p-4 text-left transition-[border-color,box-shadow] hover:border-[#b8cbaa] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2";
  const reduceMotion = useReducedMotion();
  const motionProps = {
    transition: { type: "spring" as const, bounce: 0, duration: 0.2 },
    whileHover: reduceMotion ? undefined : { y: -2 },
    whileTap: reduceMotion ? undefined : { scale: 0.98 },
  };
  return href ? (
    <MotionLink className={className} href={href} {...motionProps}>
      {content}
    </MotionLink>
  ) : (
    <motion.button className={className} onClick={onClick} type="button" {...motionProps}>
      {content}
    </motion.button>
  );
}

function SuccessIcon() {
  return (
    <span
      aria-hidden="true"
      className="bd-success-mark relative mx-auto grid size-24 place-items-center text-[#527a34]"
    >
      <Sparkles className="bd-success-sparkle absolute right-0 top-1 size-6 text-[#7ab2a4]" />
      <Sparkles className="bd-success-sparkle bd-success-sparkle-delay absolute bottom-2 left-0 size-4 text-[#c0d2a8]" />
      <Check className="bd-success-check size-16" strokeWidth={1.8} />
    </span>
  );
}

function BackToLogin({ onClick }: { readonly onClick: (e?: SyntheticEvent) => void }) {
  return (
    <button
      className="flex items-center justify-center gap-1.5 text-sm font-bold text-[#5a6b5a] transition hover:text-[#173d35] focus-visible:outline-none"
      onClick={onClick}
      type="button"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Wróć do logowania
    </button>
  );
}
