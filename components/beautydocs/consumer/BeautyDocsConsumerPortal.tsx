"use client";
import { activeIntlLocale } from "../../../lib/i18n/active";
import { BeautyDocsLanguageList, BeautyDocsLanguageMenu, useT } from "../i18n";
import { SalonLogo } from "../salons/SalonLogo";

import Link from "next/link";
import { BeautyDocsClientAuthShell } from "../auth/BeautyDocsClientAuthShell";
import { BeautyDocsEmailVerifyGate } from "../auth/BeautyDocsEmailVerifyGate";
import Image from "next/image";
import Script from "next/script";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BeautyDocsConsumerCheckInCode } from "./BeautyDocsConsumerCheckInCode";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  HeartPulse,
  History,
  Home,
  Hourglass,
  Inbox,
  KeyRound,
  LoaderCircle,
  LogOut,
  Mail,
  MailOpen,
  MapPin,
  Languages,
  Menu,
  MessageCircle,
  PenLine,
  PackageSearch,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { BeautyDocsBirthDateField } from "../BeautyDocsBirthDateField";
import { BeautyDocsChat } from "../BeautyDocsChat";
import { BeautyDocsChatBubble } from "../BeautyDocsChatBubble";
import { BeautyDocsWordmark } from "../BeautyDocsWordmark";
import { BeautyDocsDeleteAccountDialog } from "../BeautyDocsDeleteAccountDialog";
import { BeautyDocsPhoneNumberField } from "../BeautyDocsPhoneNumberField";
import { BeautyDocsAftercareRecommendations } from "./BeautyDocsAftercareRecommendations";
import { BeautyDocsConsumerCatalog } from "./BeautyDocsConsumerCatalog";
import {
  BeautyDocsSidebar,
  BeautyDocsSidebarNav,
  type BeautyDocsSidebarGroup,
} from "../BeautyDocsSidebar";
import { BeautyDocsSignupForm } from "../auth/BeautyDocsSignupForm";
import { BeautyDocsConsumerFinalizeForm } from "../auth/BeautyDocsConsumerFinalizeForm";
import { canDownloadFormPdf } from "@/lib/beautydocs-pdf-eligibility";
import { BeautyDocsPdfDownload } from "../forms/BeautyDocsPdfDownload";
import { BeautyDocsSignaturePad } from "../forms/BeautyDocsSignaturePad";
import {
  BeautyDocsTreatmentAreaVisualization,
  getTreatmentAreaLabels,
} from "../forms/BeautyDocsTreatmentAreaVisualization";
import type {
  BeautyDocsConsumerDocument,
  BeautyDocsConsumerDocumentDetail,
  BeautyDocsConsumerAppointment,
  BeautyDocsConsumerAppointmentAvailability,
  BeautyDocsConsumerAppointmentCreated,
  BeautyDocsConsumerAppointmentFormAccess,
  BeautyDocsConsumerAppointmentMonthAvailability,
  BeautyDocsConsumerLoginChallenge,
  BeautyDocsConsumerMedicalCatalog,
  BeautyDocsConsumerMedicalQuestion,
  BeautyDocsConsumerProfile,
  BeautyDocsConsumerSalon,
  BeautyDocsConsumerSalonList,
  BeautyDocsConsumerState,
  BeautyDocsGoogleLoginConfig,
} from "@/types/beautydocs-consumer";
import type {
  BeautyDocsAdminFormAnswer,
  BeautyDocsMfaChallenge,
  BeautyDocsMfaLoginChallenge,
  BeautyDocsMfaState,
} from "@/types/beautydocs-admin";
import type { BeautyDocsChatConversationList } from "@/types/beautydocs-chat";

type Screen =
  | "loading"
  | "login"
  | "emailVerify"
  | "finalize"
  | "mfaLogin"
  | "account";
type AuthMode = "register" | "login";

const inputClass =
  "w-full rounded-2xl border border-[#d4decc] bg-white px-4 py-3.5 text-xs font-black leading-4 text-[#173d35] outline-none transition placeholder:text-[#aeb3a7] focus:border-[#245c4d] focus:ring-4 focus:ring-[#245c4d]/10";

export function BeautyDocsConsumerPortal({
  initialBookFormCode = null,
  initialBookSlug = null,
  initialSection = "home",
}: {
  readonly initialBookFormCode?: string | null;
  readonly initialBookSlug?: string | null;
  readonly initialSection?: "home" | "salons";
}) {
  const t = useT();
  const [screen, setScreen] = useState<Screen>("loading");
  const [state, setState] = useState<BeautyDocsConsumerState | null>(null);
  const [documents, setDocuments] = useState<BeautyDocsConsumerDocument[]>([]);
  const [medicalCatalog, setMedicalCatalog] =
    useState<BeautyDocsConsumerMedicalCatalog>({ questions: [] });
  const [verificationEmail, setVerificationEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [resendUntil, setResendUntil] = useState(0);
  const [resendWaiting, setResendWaiting] = useState(false);
  // One-time token from e-mail verification; authorizes the finalize step.
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  const [registrationPassword, setRegistrationPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<BeautyDocsConsumerDocumentDetail | null>(null);
  const [googleConfig, setGoogleConfig] =
    useState<BeautyDocsGoogleLoginConfig | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [mfaLoginChallenge, setMfaLoginChallenge] =
    useState<BeautyDocsMfaLoginChallenge | null>(null);
  const [mfaLoginCode, setMfaLoginCode] = useState("");
  const [documentUpdateNotice, setDocumentUpdateNotice] = useState<string | null>(null);
  const googleTokenClientRef = useRef<GoogleTokenClient | null>(null);
  const documentsRef = useRef<BeautyDocsConsumerDocument[]>([]);
  const documentsInitializedRef = useRef(false);

  const loadDocuments = useCallback(async () => {
    const response = await fetch("/api/beautydocs-preview/consumer/documents", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.ok) {
      const body = (await response.json()) as { items?: BeautyDocsConsumerDocument[] };
      const nextDocuments = Array.isArray(body.items) ? body.items : [];
      if (documentsInitializedRef.current) {
        const previousStatuses = new Map(
          documentsRef.current.map((document) => [document.submissionId, document.status]),
        );
        const newlySigned = nextDocuments.find(
          (document) =>
            document.status === "SIGNED" &&
            previousStatuses.get(document.submissionId) === "SUBMITTED",
        );
        if (newlySigned) {
          setDocumentUpdateNotice(
            t("Salon podpisał formularz „{formName}”. Dokument jest już kompletny.", { formName: newlySigned.formName }),
          );
        }
      } else {
        documentsInitializedRef.current = true;
      }
      documentsRef.current = nextDocuments;
      setDocuments(nextDocuments);
    }
  }, [t]);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/beautydocs-preview/consumer/me", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setScreen("login");
        return;
      }
      setState((await response.json()) as BeautyDocsConsumerState);
      setScreen("account");
      await loadDocuments();
    })();
  }, [loadDocuments]);

  useEffect(() => {
    void (async () => {
      const response = await fetch(
        "/api/beautydocs-preview/consumer/auth/google/config",
        { cache: "no-store", credentials: "same-origin" },
      );
      if (response.ok) {
        setGoogleConfig((await response.json()) as BeautyDocsGoogleLoginConfig);
      }
    })();
  }, []);

  useEffect(() => {
    if (screen !== "account") return;
    void (async () => {
      const response = await fetch(
        "/api/beautydocs-preview/consumer/profile/medical",
        { cache: "no-store", credentials: "same-origin" },
      );
      if (response.ok) {
        setMedicalCatalog(
          (await response.json()) as BeautyDocsConsumerMedicalCatalog,
        );
      }
    })();
  }, [screen]);

  useEffect(() => {
    if (screen !== "account") return;
    const refreshVisibleDocuments = () => {
      if (document.visibilityState === "visible") void loadDocuments();
    };
    const interval = window.setInterval(refreshVisibleDocuments, 15_000);
    window.addEventListener("focus", refreshVisibleDocuments);
    document.addEventListener("visibilitychange", refreshVisibleDocuments);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisibleDocuments);
      document.removeEventListener("visibilitychange", refreshVisibleDocuments);
    };
  }, [loadDocuments, screen]);

  useEffect(() => {
    if (!documentUpdateNotice) return;
    const timeout = window.setTimeout(() => setDocumentUpdateNotice(null), 7_000);
    return () => window.clearTimeout(timeout);
  }, [documentUpdateNotice]);

  useEffect(() => {
    if (!detail) return;
    const summary = documents.find(
      (document) => document.submissionId === detail.submissionId,
    );
    if (
      !summary ||
      (summary.status === detail.status &&
        summary.practitionerSignedAt === detail.practitionerSignedAt)
    ) {
      return;
    }
    void (async () => {
      const response = await fetch(
        `/api/beautydocs-preview/consumer/documents/${encodeURIComponent(detail.submissionId)}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      if (response.ok) {
        setDetail((await response.json()) as BeautyDocsConsumerDocumentDetail);
      }
    })();
  }, [detail, documents]);

  const loginWithGoogle = useCallback(
    async (accessToken: string) => {
      setPending(true);
      setError(null);
      const response = await fetch(
        "/api/beautydocs-preview/consumer/auth/google",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accessToken }),
        },
      );
      setPending(false);
      if (!response.ok) {
        setError(
          response.status === 409
            ? t("To konto Google jest już połączone z innym profilem BeautyDocs. Zaloguj się adresem e-mail i hasłem.")
            : t("Nie udało się zalogować przez Google. Spróbuj ponownie."),
        );
        return;
      }
      setState((await response.json()) as BeautyDocsConsumerState);
      setScreen("account");
      await loadDocuments();
    },
    [loadDocuments, t],
  );

  useEffect(() => {
    const clientId = googleConfig?.enabled ? googleConfig.clientId : null;
    const oauth2 = window.google?.accounts?.oauth2;
    if (!googleReady || !oauth2 || !clientId) return;
    googleTokenClientRef.current = oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      callback: (response) => {
        if (!response.access_token) {
          setError(t("Nie udało się połączyć z Google. Spróbuj ponownie."));
          return;
        }
        void loginWithGoogle(response.access_token);
      },
    });
  }, [googleConfig, googleReady, loginWithGoogle, t]);

  const requestGoogle = () => {
    const client = googleTokenClientRef.current;
    if (!client) {
      setError(t("Google jeszcze się ładuje. Spróbuj za chwilę."));
      return;
    }
    setError(null);
    client.requestAccessToken();
  };

  // Step 1: capture only the e-mail and send a verification code.
  const startRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setPending(true);
    const email = String(form.get("email") ?? "").trim();
    const response = await fetch(
      "/api/beautydocs-preview/consumer/auth/register",
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      },
    );
    setPending(false);
    if (!response.ok) {
      setError(
        response.status === 409
          ? t("Ten adres e-mail jest już używany. Zaloguj się lub użyj innego adresu.")
          : t("Nie udało się wysłać kodu. Sprawdź adres e-mail i spróbuj ponownie."),
      );
      return;
    }
    const body = (await response.json()) as {
      email: string;
      devCode: string | null;
    };
    setVerificationEmail(body.email);
    setDevCode(body.devCode);
    setCode("");
    setRegistrationToken(null);
    setRegistrationPassword("");
    setResent(false);
    setResendWaiting(false);
    setResendUntil(0);
    setScreen("emailVerify");
  };

  useEffect(() => {
    if (!resendUntil) return;
    const timer = setTimeout(
      () => setResendWaiting(false),
      Math.max(0, resendUntil - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [resendUntil]);

  const resendCode = async () => {
    if (pending || Date.now() < resendUntil) return;
    setPending(true);
    setError(null);
    setResent(false);
    const response = await fetch(
      "/api/beautydocs-preview/consumer/auth/register",
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: verificationEmail }),
      },
    );
    setPending(false);
    if (!response.ok) {
      setError(t("Nie udało się wysłać kodu. Spróbuj ponownie za chwilę."));
      return;
    }
    const body = (await response.json()) as { devCode: string | null };
    setDevCode(body.devCode);
    setCode("");
    setResent(true);
    setResendWaiting(true);
    setResendUntil(Date.now() + 60_000);
  };

  // Step 2: confirm the e-mail; the token authorizes the finalize step.
  const verifyEmailRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError(t("Wpisz pełny 6-cyfrowy kod."));
      return;
    }
    setPending(true);
    setError(null);
    const response = await fetch(
      "/api/beautydocs-preview/consumer/auth/register/verify",
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: verificationEmail, code }),
      },
    );
    setPending(false);
    if (!response.ok) {
      setError(t("Kod jest nieprawidłowy lub wygasł."));
      return;
    }
    const body = (await response.json()) as { registrationToken?: string };
    setRegistrationToken(
      typeof body.registrationToken === "string" ? body.registrationToken : null,
    );
    setError(null);
    setScreen("finalize");
  };

  // Step 3: name + password create the account and log the client in.
  const completeRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    const password = String(form.get("password") ?? "");
    const repeatedPassword = String(form.get("confirmPassword") ?? "");
    if (password !== repeatedPassword) {
      setError(t("Hasła nie są takie same."));
      return;
    }
    if (password.length < 8) {
      setError(t("Hasło musi mieć co najmniej 8 znaków."));
      return;
    }
    if (registrationToken === null) {
      setError(t("Sesja rejestracji wygasła. Zacznij zakładanie konta od nowa."));
      setScreen("login");
      return;
    }
    setPending(true);
    const response = await fetch(
      "/api/beautydocs-preview/consumer/auth/register/complete",
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          registrationToken,
          fullName: String(form.get("fullName") ?? "").trim(),
          password,
        }),
      },
    );
    setPending(false);
    if (!response.ok) {
      const code = await response
        .json()
        .then((data: { error?: { code?: string } }) => data?.error?.code ?? null)
        .catch(() => null);
      setError(
        code === "email_taken"
          ? t("Ten adres e-mail jest już używany. Zaloguj się zamiast zakładać nowe konto.")
          : code === "invalid_registration"
            ? t("Sesja rejestracji wygasła. Zacznij zakładanie konta od nowa.")
            : t("Nie udało się założyć konta. Spróbuj ponownie."),
      );
      return;
    }
    setState((await response.json()) as BeautyDocsConsumerState);
    setScreen("account");
    await loadDocuments();
  };

  const loginWithPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const response = await fetch(
      "/api/beautydocs-preview/consumer/auth/password",
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
        }),
      },
    );
    setPending(false);
    if (!response.ok) {
      setError(
        response.status === 401
          ? t("Nieprawidłowy adres e-mail lub hasło.")
          : response.status === 403
            ? t("Najpierw potwierdź adres e-mail kodem wysłanym podczas rejestracji.")
          : t("Logowanie jest chwilowo niedostępne. Spróbuj ponownie."),
      );
      return;
    }
    const data = (await response.json()) as
      | BeautyDocsConsumerState
      | BeautyDocsMfaLoginChallenge;
    if ("mfaRequired" in data && data.mfaRequired === true) {
      setMfaLoginChallenge(data);
      setMfaLoginCode("");
      setScreen("mfaLogin");
      return;
    }
    setState(data as BeautyDocsConsumerState);
    setScreen("account");
    await loadDocuments();
  };

  const confirmMfaLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mfaLoginChallenge || !/^\d{6}$/.test(mfaLoginCode)) {
      setError(t("Wpisz pełny 6-cyfrowy kod."));
      return;
    }
    setPending(true);
    setError(null);
    const response = await fetch(
      "/api/beautydocs-preview/consumer/mfa/login/confirm",
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeId: mfaLoginChallenge.challengeId,
          code: mfaLoginCode,
        }),
      },
    );
    setPending(false);
    if (!response.ok) {
      setError(t("Kod jest nieprawidłowy lub wygasł."));
      return;
    }
    setState((await response.json()) as BeautyDocsConsumerState);
    setMfaLoginChallenge(null);
    setMfaLoginCode("");
    setScreen("account");
    await loadDocuments();
  };

  const cancelMfaLogin = () => {
    setMfaLoginChallenge(null);
    setMfaLoginCode("");
    setError(null);
    setScreen("login");
  };

  const logout = async () => {
    await fetch("/api/beautydocs-preview/consumer/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    setState(null);
    setDocuments([]);
    documentsRef.current = [];
    documentsInitializedRef.current = false;
    setDocumentUpdateNotice(null);
    setMedicalCatalog({ questions: [] });
    setDetail(null);
    window.google?.accounts.id.disableAutoSelect();
    setAuthMode("login");
    setScreen("login");
  };

  const openDocument = async (submissionId: string) => {
    setPending(true);
    const response = await fetch(
      `/api/beautydocs-preview/consumer/documents/${encodeURIComponent(submissionId)}`,
      { cache: "no-store", credentials: "same-origin" },
    );
    setPending(false);
    if (response.ok) setDetail((await response.json()) as BeautyDocsConsumerDocumentDetail);
  };

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-[#173d35]">
      {googleConfig?.enabled ? (
        <Script
          onError={() => setError(t("Nie udało się załadować logowania Google."))}
          onLoad={() => setGoogleReady(true)}
          onReady={() => setGoogleReady(true)}
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />
      ) : null}
      {screen === "loading" ? (
        <div className="flex min-h-screen items-center justify-center">
          <LoaderCircle className="size-8 animate-spin text-[#245c4d]" />
        </div>
      ) : screen === "emailVerify" ? (
        <BeautyDocsEmailVerifyGate
          code={code}
          devCode={devCode}
          email={verificationEmail}
          error={error}
          onChangeEmail={() => setScreen("login")}
          onCodeChange={setCode}
          onResend={resendCode}
          onSubmit={verifyEmailRegistration}
          pending={pending}
          resendWaiting={resendWaiting}
          resent={resent}
          variant="client"
        />
      ) : screen === "login" ? (
        <LoginCard
          authMode={authMode}
          error={error}
          googleEnabled={googleConfig?.enabled === true}
          onGoogle={requestGoogle}
          onAuthModeChange={(mode) => {
            setAuthMode(mode);
            setError(null);
          }}
          onLoginWithPassword={loginWithPassword}
          onStartRegistration={startRegistration}
          pending={pending}
        />
      ) : screen === "finalize" ? (
        <FinalizeCard
          email={verificationEmail}
          error={error}
          onPasswordChange={setRegistrationPassword}
          onSubmit={completeRegistration}
          password={registrationPassword}
          pending={pending}
        />
      ) : screen === "mfaLogin" && mfaLoginChallenge ? (
        <MfaLoginChallengeCard
          challenge={mfaLoginChallenge}
          code={mfaLoginCode}
          error={error}
          onCancel={cancelMfaLogin}
          onCodeChange={setMfaLoginCode}
          onSubmit={confirmMfaLogin}
          pending={pending}
        />
      ) : state ? (
        <AccountView
          detail={detail}
          documents={documents}
          initialBookFormCode={initialBookFormCode}
          initialBookSlug={initialBookSlug}
          initialSection={initialSection}
          medicalCatalog={medicalCatalog}
          onCloseDetail={() => setDetail(null)}
          onLogout={logout}
          onOpenDocument={openDocument}
          onProfileChange={setState}
          onRefreshDocuments={loadDocuments}
          pending={pending}
          state={state}
        />
      ) : null}
      <AnimatePresence>
        {documentUpdateNotice ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-5 left-1/2 z-[80] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-start gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3.5 text-sm shadow-2xl"
            exit={{ opacity: 0, y: 12 }}
            initial={{ opacity: 0, y: 12 }}
            role="status"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1 pt-0.5 font-bold leading-6 text-[#173d35]">
              {documentUpdateNotice}
            </span>
            <button
              aria-label={t("Zamknij powiadomienie")}
              className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              onClick={() => setDocumentUpdateNotice(null)}
              type="button"
            >
              <X className="size-4" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function ConsumerGoogleGlyph({ className = "" }: { readonly className?: string }) {
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

function LoginCard({
  authMode,
  error,
  googleEnabled,
  onAuthModeChange,
  onGoogle,
  onLoginWithPassword,
  onStartRegistration,
  pending,
}: {
  readonly authMode: AuthMode;
  readonly error: string | null;
  readonly googleEnabled: boolean;
  readonly onAuthModeChange: (mode: AuthMode) => void;
  readonly onGoogle: () => void;
  readonly onLoginWithPassword: (event: FormEvent<HTMLFormElement>) => void;
  readonly onStartRegistration: (event: FormEvent<HTMLFormElement>) => void;
  readonly pending: boolean;
}) {
  const t = useT();
  const heading = {
    eyebrow: t("Konto osobiste"),
    title: authMode === "register" ? t("Utwórz swój profil") : t("Zaloguj się"),
  };
  const reduceMotion = useReducedMotion();
  const stepTransition = reduceMotion
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
  return (
    <BeautyDocsClientAuthShell>
      <div className="bd-auth-card">
          <Link
            aria-label={t("BeautyDocs — strona główna")}
            className="bd-auth-card-brand"
            href="/"
          >
            <BeautyDocsWordmark className="text-xl text-[#173d35]" />
          </Link>
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              animate={stepTransition.animate}
              exit={stepTransition.exit}
              initial={stepTransition.initial}
              key={authMode}
              transition={stepTransition.transition}
            >
          <p className="text-center text-xs font-black uppercase tracking-[0.18em] text-[#426447]">
            {t(heading.eyebrow)}
          </p>
          <h1 className="mt-2 text-center font-serif text-3xl font-medium tracking-tight text-[#173d35] sm:text-4xl">
            {t(heading.title)}
          </h1>

          <div className="mt-8">
              {authMode === "register" ? (
                <BeautyDocsSignupForm
                  backLabel={t("Zmień typ konta")}
                  error={error}
                  googleEnabled={googleEnabled}
                  onBack={() => {
                    window.location.href = "/konto?mode=register";
                  }}
                  onGoogle={onGoogle}
                  onSubmit={onStartRegistration}
                  onSwitchToLogin={() => onAuthModeChange("login")}
                  pending={pending}
                />
              ) : (
                <>
                  {googleEnabled ? (
                    <>
                      <motion.button
                        className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-[#d4decc] bg-white px-4 text-sm font-black text-[#173d35] shadow-[0_1px_2px_rgba(38,65,58,0.04)] transition-colors hover:border-[#b8cbaa] hover:bg-[#eef3e7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2 disabled:opacity-60"
                        disabled={pending}
                        onClick={onGoogle}
                        transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                        type="button"
                        whileTap={reduceMotion || pending ? undefined : { scale: 0.97 }}
                      >
                        <ConsumerGoogleGlyph className="size-5 shrink-0" />
                        {t("Zaloguj się przez Google")}
                      </motion.button>
                      <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-stone-400">
                        <span className="h-px flex-1 bg-stone-200" />
                        {t("lub zaloguj się e-mailem")}
                        <span className="h-px flex-1 bg-stone-200" />
                      </div>
                    </>
                  ) : (
                    <div className="h-6" />
                  )}

                  <form className="space-y-5" onSubmit={onLoginWithPassword}>
                    <AuthTextField
                      autoComplete="email"
                      label={t("Adres e-mail")}
                      name="email"
                      placeholder="twoj@email.pl"
                      type="email"
                    />
                    <label className="block text-xs font-black uppercase tracking-[0.14em] text-[#5a6b5a]">
                      {t("Hasło")}
                      <AuthPasswordField
                        autoComplete="current-password"
                        minLength={1}
                        name="password"
                        placeholder={t("Twoje hasło")}
                      />
                    </label>
                    <ErrorMessage message={error} />
                    <PrimaryButton pending={pending}>{t("Zaloguj się")}</PrimaryButton>
                  </form>

                  <p className="mt-5 text-center text-sm text-stone-600">
                    {t("Nie masz konta?")}{" "}
                    <button
                      className="font-bold text-[#245c4d] underline-offset-4 transition hover:text-[#173d35] hover:underline"
                      onClick={() => onAuthModeChange("register")}
                      type="button"
                    >
                      {t("Załóż konto")}
                    </button>
                  </p>
                </>
              )}
          </div>
            </motion.div>
          </AnimatePresence>
      </div>
    </BeautyDocsClientAuthShell>
  );
}

function FinalizeCard({
  email,
  error,
  password,
  onPasswordChange,
  onSubmit,
  pending,
}: {
  readonly email: string;
  readonly error: string | null;
  readonly password: string;
  readonly onPasswordChange: (value: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly pending: boolean;
}) {
  const t = useT();
  return (
    <BeautyDocsClientAuthShell>
      <div className="bd-auth-card">
        <Link
          aria-label={t("BeautyDocs — strona główna")}
          className="bd-auth-card-brand"
          href="/"
        >
          <BeautyDocsWordmark className="text-xl text-[#173d35]" />
        </Link>
        <p className="text-center text-xs font-black uppercase tracking-[0.18em] text-[#426447]">
          {t("Krok 2 z 2")}
        </p>
        <h1 className="mb-8 mt-2 text-center font-serif text-3xl font-medium tracking-tight text-[#173d35] sm:text-4xl">
          {t("Dokończ zakładanie konta")}
        </h1>
        <p className="bd-auth-verified" role="status"><Check size={17} aria-hidden="true" />{" "}{t("Adres e-mail potwierdzony")}</p>
        <BeautyDocsConsumerFinalizeForm
          email={email}
          error={error}
          onPasswordChange={onPasswordChange}
          onSubmit={onSubmit}
          password={password}
          pending={pending}
        />
      </div>
    </BeautyDocsClientAuthShell>
  );
}

function MfaLoginChallengeCard({
  challenge,
  code,
  error,
  onCancel,
  onCodeChange,
  onSubmit,
  pending,
}: {
  readonly challenge: BeautyDocsMfaLoginChallenge;
  readonly code: string;
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onCodeChange: (value: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly pending: boolean;
}) {
  const t = useT();
  return (
    <BeautyDocsClientAuthShell>
      <div className="bd-auth-card">
        <Link
          aria-label={t("BeautyDocs — strona główna")}
          className="bd-auth-card-brand"
          href="/"
        >
          <BeautyDocsWordmark className="text-xl text-[#173d35]" />
        </Link>
        <p className="text-center text-xs font-black uppercase tracking-[0.18em] text-[#426447]">
          {t("Weryfikacja dwuetapowa")}
        </p>
        <h1 className="mb-8 mt-2 text-center font-serif text-3xl font-medium tracking-tight text-[#173d35] sm:text-4xl">
          {t("Potwierdź logowanie")}
        </h1>
        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="rounded-2xl border border-[#dce3d5] bg-[#f0f4e9] p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#e4ecd8] text-[#245c4d]">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <p className="font-black text-[#173d35]">
                  {challenge.method === "SMS"
                    ? t("Kod został wysłany SMS-em")
                    : t("Otwórz aplikację uwierzytelniającą")}
                </p>
                <p className="mt-1 text-sm leading-6 text-stone-500">
                  {challenge.method === "SMS"
                    ? t("Wpisz kod wysłany na {value1}.", { value1: challenge.destinationMasked ?? "zweryfikowany numer telefonu" })
                    : t("Wpisz aktualny kod z Google Authenticator lub innej połączonej aplikacji.")}
                </p>
              </div>
            </div>
          </div>

          <label className="block text-xs font-black uppercase tracking-[0.14em] text-[#5a6b5a]">
            {t("Kod 6-cyfrowy")}
            <input
              autoComplete="one-time-code"
              className={`${inputClass} mt-2 text-center text-lg tracking-[0.35em]`}
              disabled={pending}
              inputMode="numeric"
              maxLength={6}
              onChange={(event) =>
                onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              value={code}
            />
          </label>

          {challenge.devCode ? (
            <p className="rounded-xl bg-[#eaf0e2] px-3 py-2 text-center text-xs text-[#426447]">
              {t("Tryb lokalny — kod:")}{" "}
              <span className="font-black tracking-widest">{challenge.devCode}</span>
            </p>
          ) : null}

          <ErrorMessage message={error} />
          <PrimaryButton pending={pending}>{t("Potwierdź logowanie")}</PrimaryButton>
          <button
            className="mx-auto block text-sm font-bold text-[#245c4d]"
            onClick={onCancel}
            type="button"
          >
            {t("Wróć do logowania")}
          </button>
        </form>
      </div>
    </BeautyDocsClientAuthShell>
  );
}

function AuthTextField({
  autoComplete,
  label,
  name,
  onChange,
  placeholder,
  type,
  value,
}: {
  readonly autoComplete: string;
  readonly label: string;
  readonly name?: string;
  readonly onChange?: (value: string) => void;
  readonly placeholder: string;
  readonly type: "email" | "tel" | "text";
  readonly value?: string;
}) {
  const t = useT();
  return (
    <label className="block text-xs font-black uppercase tracking-[0.14em] text-[#5a6b5a]">
      {t(label)}
      <span className="mt-2 block">
        <input
          autoComplete={autoComplete}
          className={inputClass}
          name={name}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
          placeholder={t(placeholder)}
          required
          type={type}
          value={value}
        />
      </span>
    </label>
  );
}

function AuthPasswordField({
  autoComplete = "new-password",
  minLength = 8,
  name,
  onValueChange,
  placeholder,
}: {
  readonly autoComplete?: string;
  readonly minLength?: number;
  readonly name: string;
  readonly onValueChange?: (value: string) => void;
  readonly placeholder: string;
}) {
  const t = useT();
  const [show, setShow] = useState(false);
  return (
    <span className="relative mt-2 block">
      <input
        autoComplete={autoComplete}
        className={`${inputClass} pl-4 pr-12`}
        maxLength={1024}
        minLength={minLength}
        name={name}
        onChange={(event) => onValueChange?.(event.target.value)}
        placeholder={t(placeholder)}
        required
        type={show ? "text" : "password"}
      />
      <button
        aria-label={show ? t("Ukryj hasło") : t("Pokaż hasło")}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#6a7a62] transition hover:text-[#245c4d]"
        onClick={() => setShow((current) => !current)}
        type="button"
      >
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </span>
  );
}

type ConsumerPortalSection =
  | "home"
  | "salons"
  | "appointments"
  | "personal"
  | "medical"
  | "catalog"
  | "signature"
  | "inbox"
  | "chat"
  | "documents"
  | "settings";

const portalNavigation: readonly {
  readonly id: ConsumerPortalSection;
  readonly label: string;
  readonly icon: typeof Home;
  readonly group: string;
}[] = [
  { id: "home", label: "Start", icon: Home, group: "Menu" },
  { id: "salons", label: "Znajdź salon", icon: Search, group: "Menu" },
  { id: "appointments", label: "Moje wizyty", icon: CalendarDays, group: "Menu" },
  { id: "personal", label: "Dane osobowe", icon: UserRound, group: "Menu" },
  { id: "medical", label: "Wywiad medyczny", icon: HeartPulse, group: "Menu" },
  { id: "catalog", label: "Katalog", icon: PackageSearch, group: "Menu" },
  { id: "signature", label: "Mój podpis", icon: PenLine, group: "Menu" },
  { id: "inbox", label: "Skrzynka", icon: Inbox, group: "Konto" },
  { id: "chat", label: "Czat", icon: MessageCircle, group: "Konto" },
  { id: "documents", label: "Historia dokumentów", icon: FileText, group: "Konto" },
  { id: "settings", label: "Ustawienia", icon: Settings, group: "Konto" },
];

function buildConsumerGroups(
  activeSection: ConsumerPortalSection,
  onSelect: (section: ConsumerPortalSection) => void,
  unreadInboxCount: number,
  unreadChatCount: number,
): BeautyDocsSidebarGroup[] {
  return ["Menu", "Konto"].map((label) => ({
    label,
    items: portalNavigation
      .filter((item) => item.group === label)
      .map((item) => ({
        icon: item.icon,
        label: item.label,
        badge:
          item.id === "inbox"
            ? unreadInboxCount
            : item.id === "chat"
              ? unreadChatCount
              : undefined,
        active: activeSection === item.id,
        onClick: () => onSelect(item.id),
      })),
  }));
}

function AccountView({
  detail,
  documents,
  initialBookFormCode,
  initialBookSlug,
  initialSection,
  medicalCatalog,
  onCloseDetail,
  onLogout,
  onOpenDocument,
  onProfileChange,
  onRefreshDocuments,
  pending,
  state,
}: {
  readonly detail: BeautyDocsConsumerDocumentDetail | null;
  readonly documents: BeautyDocsConsumerDocument[];
  readonly initialBookFormCode: string | null;
  readonly initialBookSlug: string | null;
  readonly initialSection: "home" | "salons";
  readonly medicalCatalog: BeautyDocsConsumerMedicalCatalog;
  readonly onCloseDetail: () => void;
  readonly onLogout: () => void;
  readonly onOpenDocument: (id: string) => void;
  readonly onProfileChange: (state: BeautyDocsConsumerState) => void;
  readonly onRefreshDocuments: () => Promise<void>;
  readonly pending: boolean;
  readonly state: BeautyDocsConsumerState;
}) {
  const t = useT();
  const [activeSection, setActiveSection] =
    useState<ConsumerPortalSection>(initialSection);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const onboardingStorageKey = buildConsumerOnboardingStorageKey(state.profile);
  const [setupOpen, setSetupOpen] = useState(
    () =>
      !isConsumerProfileComplete(state.profile) &&
      !hasSeenConsumerOnboarding(onboardingStorageKey),
  );
  const [chatSalon, setChatSalon] = useState<{ slug: string; displayName: string } | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const profile = state.profile;
  const inboxStorageKey = buildConsumerInboxStorageKey(profile);
  const [readInboxMessageIds, setReadInboxMessageIds] = useState<Set<string>>(
    () => readConsumerInboxMessageIds(inboxStorageKey),
  );
  const inboxMessages = useMemo(
    () => buildConsumerInboxMessages(documents),
    [documents],
  );
  const unreadInboxCount = inboxMessages.filter(
    (message) => !readInboxMessageIds.has(message.id),
  ).length;
  const answeredQuestions = medicalCatalog.questions.filter(
    (question) => profile.medicalAnswers[question.key]?.answer,
  ).length;
  const personalComplete = isPersonalDataComplete(profile);
  const medicalComplete =
    medicalCatalog.questions.length > 0 &&
    answeredQuestions === medicalCatalog.questions.length;
  const completedSteps = [
    personalComplete,
    medicalComplete,
    profile.signatureConfigured,
  ].filter(Boolean).length;
  const progress = Math.round((completedSteps / 3) * 100);
  const activeLabel =
    portalNavigation.find((item) => item.id === activeSection)?.label ?? t("Start");

  useEffect(() => {
    try {
      window.localStorage.setItem(
        inboxStorageKey,
        JSON.stringify(Array.from(readInboxMessageIds).slice(-500)),
      );
    } catch {
      // Tryb prywatny może blokować localStorage; skrzynka nadal działa w sesji.
    }
  }, [inboxStorageKey, readInboxMessageIds]);

  useEffect(() => {
    let cancelled = false;
    const loadUnread = async () => {
      try {
        const response = await fetch("/api/beautydocs-preview/consumer/chats", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const body = (await response.json()) as BeautyDocsChatConversationList;
        if (!cancelled && Number.isInteger(body.unreadCount)) {
          setUnreadChatCount(Math.max(0, body.unreadCount));
        }
      } catch {
        // Licznik jest dodatkiem; pozostałe części panelu nadal działają.
      }
    };
    const handleUpdate = (event: Event) => {
      const value = (event as CustomEvent<{ unreadCount?: unknown }>).detail?.unreadCount;
      if (typeof value === "number") setUnreadChatCount(Math.max(0, Math.trunc(value)));
    };
    void loadUnread();
    const timer = window.setInterval(loadUnread, 15_000);
    window.addEventListener("focus", loadUnread);
    window.addEventListener("beautydocs:chat-updated", handleUpdate);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", loadUnread);
      window.removeEventListener("beautydocs:chat-updated", handleUpdate);
    };
  }, []);

  const markInboxMessageRead = (messageId: string) => {
    setReadInboxMessageIds((current) => {
      if (current.has(messageId)) return current;
      const next = new Set(current);
      next.add(messageId);
      return next;
    });
  };

  const selectSection = (section: ConsumerPortalSection) => {
    setActiveSection(section);
    setMobileMenuOpen(false);
  };
  const consumerGroups = buildConsumerGroups(
    activeSection,
    selectSection,
    unreadInboxCount,
    unreadChatCount,
  );

  return (
    <div className={`min-h-screen bg-[#f4f7f1] ${activeSection === "catalog" ? "" : "lg:grid lg:grid-cols-[280px_minmax(0,1fr)]"}`}>
      {activeSection !== "catalog" && <aside className="hidden min-h-screen border-r border-[#e7ecdf] bg-[#f8fbf5] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <BeautyDocsSidebar
          context={<ConsumerSidebarCard profile={profile} progress={progress} />}
          footer={
            <button
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold text-[#5a6b5a] transition hover:bg-[#eff4e7] hover:text-[#173d35]"
              onClick={onLogout}
              type="button"
            >
              <LogOut className="size-[18px]" />{" "}{t("Wyloguj się")}
            </button>
          }
          groups={consumerGroups}
          logoOnClick={() => selectSection("home")}
          subtitle={t("Twoja strefa")}
        />
      </aside>}

      <div className="min-w-0">
        <header className={`sticky top-0 z-30 border-b border-[#e1e6da] bg-[#fdfffb]/90 px-4 py-3 backdrop-blur-xl sm:px-7 ${activeSection === "catalog" ? "" : "lg:hidden"}`}>
          <div className="flex items-center justify-between gap-3">
            <button
              aria-label={t("Wróć do strony głównej panelu")}
              className="flex items-center gap-2.5"
              onClick={() => selectSection("home")}
              type="button"
            >
              <span aria-hidden="true" className="text-[30px] leading-none text-[#66845b]">✳</span>
              <BeautyDocsWordmark className="text-lg text-[#173d35]" />
            </button>
            <div className="flex items-center gap-2">
            <BeautyDocsLanguageMenu account="consumer" />
            <button
              aria-label={mobileMenuOpen ? t("Zamknij menu") : t("Otwórz menu")}
              aria-expanded={mobileMenuOpen}
              aria-controls="consumer-navigation-menu"
              className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-[#dee4d6] bg-white p-2.5 text-[#173d35] active:bg-[#e8eedf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d]"
              onClick={() => setMobileMenuOpen((value) => !value)}
              type="button"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            </div>
          </div>
          <AnimatePresence>
            {mobileMenuOpen ? (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                id="consumer-navigation-menu"
                className="overflow-hidden pt-3"
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
              >
                <BeautyDocsSidebarNav
                  className="grid grid-cols-2 gap-2"
                  compact
                  groups={consumerGroups}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </header>

        <main className={`mx-auto w-full ${activeSection === "catalog" ? "" : "max-w-[1280px]"} px-4 py-7 sm:px-7 sm:py-10 xl:px-12`}>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#599687]">
                {t("Twoja strefa")}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#173d35] sm:text-4xl">
                {activeSection === "home"
                  ? t("Dzień dobry, {value1}", { value1: profile.fullName.split(" ")[0] })
                  : activeLabel}
              </h1>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-[#e3ead9] px-4 py-2.5 text-sm font-black text-[#45766a] transition hover:bg-[#d4dfc5]"
              onClick={() => setSetupOpen(true)}
              type="button"
            >
              <Sparkles className="size-4" />{" "}{t("Uzupełnij profil")}
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              initial={{ opacity: 0, y: 10 }}
              key={activeSection}
              transition={{ duration: 0.22 }}
            >
              {activeSection === "home" ? (
                <ConsumerDashboard
                  answeredQuestions={answeredQuestions}
                  documents={documents}
                  medicalComplete={medicalComplete}
                  onOpenSetup={() => setSetupOpen(true)}
                  onSelect={selectSection}
                  personalComplete={personalComplete}
                  profile={profile}
                  progress={progress}
                  questionCount={medicalCatalog.questions.length}
                />
              ) : null}
              {activeSection === "personal" ? (
                <PersonalDataPanel
                  onProfileChange={onProfileChange}
                  profile={profile}
                />
              ) : null}
              {activeSection === "salons" ? (
                <ConsumerSalonDirectory
                  documents={documents}
                  initialBookFormCode={initialBookFormCode}
                  initialBookSlug={initialBookSlug}
                  onGoToProfile={() => selectSection("personal")}
                  onStartChat={(salon) => {
                    setChatSalon(salon);
                    selectSection("chat");
                  }}
                  phoneReady={state.phoneVerified}
                  profile={profile}
                />
              ) : null}
              {activeSection === "appointments" ? (
                <ConsumerAppointmentsPanel
                  onSelect={selectSection}
                  onStartChat={(salon) => {
                    setChatSalon(salon);
                    selectSection("chat");
                  }}
                />
              ) : null}
              {activeSection === "medical" ? (
                <MedicalInterviewPanel
                  catalog={medicalCatalog}
                  onProfileChange={onProfileChange}
                  profile={profile}
                />
              ) : null}
              {activeSection === "catalog" ? <BeautyDocsConsumerCatalog /> : null}
              {activeSection === "signature" ? (
                <ConsumerSignaturePanel
                  onProfileChange={onProfileChange}
                  profile={profile}
                />
              ) : null}
              {activeSection === "inbox" ? (
                <ConsumerInboxPanel
                  messages={inboxMessages}
                  onOpenDocument={onOpenDocument}
                  onRead={markInboxMessageRead}
                  onRefresh={onRefreshDocuments}
                  readMessageIds={readInboxMessageIds}
                />
              ) : null}
              {activeSection === "chat" ? (
                <BeautyDocsChat
                  initialSalon={chatSalon}
                  mode="consumer"
                  onFindSalon={() => selectSection("salons")}
                />
              ) : null}
              {activeSection === "documents" ? (
                <div className="space-y-6">
                  <BeautyDocsConsumerCheckInCode />
                  <ConsumerDocumentsPanel
                    documents={documents}
                    onOpenDocument={onOpenDocument}
                  />
                </div>
              ) : null}
              {activeSection === "settings" ? <ConsumerAccountSettings /> : null}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {pending ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-full bg-[#173d35] p-3 text-white shadow-xl">
          <LoaderCircle className="size-5 animate-spin" />
        </div>
      ) : null}
      <AnimatePresence>
        {setupOpen ? (
          <ConsumerSetupDialog
            catalog={medicalCatalog}
            onClose={() => {
              markConsumerOnboardingSeen(onboardingStorageKey);
              setSetupOpen(false);
            }}
            onProfileChange={onProfileChange}
            profile={profile}
          />
        ) : null}
      </AnimatePresence>
      {detail ? <DocumentDialog detail={detail} onClose={onCloseDetail} /> : null}
      {activeSection !== "chat" ? (
        <BeautyDocsChatBubble
          mode="consumer"
          onFindSalon={() => selectSection("salons")}
          unreadCount={unreadChatCount}
        />
      ) : null}
    </div>
  );
}

function ConsumerSidebarCard({
  profile,
  progress,
}: {
  readonly profile: BeautyDocsConsumerProfile;
  readonly progress: number;
}) {
  const t = useT();
  return (
    <div className="rounded-2xl border border-[#e4ecd9] bg-[#f1f6eb] p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#c1d8a1] text-xs font-black text-[#253833]">
          {profile.fullName.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-black text-[#173d35]">{profile.fullName}</p>
          <p className="truncate text-[11px] text-[#5a6b5a]">
            {profile.email ?? profile.phone ?? t("Konto klientki")}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-[#5a6b5a]">
        <span>{t("Kompletność profilu")}</span>
        <span>{progress}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e5eadf]">
        <motion.div
          animate={{ width: `${progress}%` }}
          className="h-full rounded-full bg-[#245c4d]"
          initial={false}
        />
      </div>
    </div>
  );
}

function ConsumerDashboard({
  answeredQuestions,
  documents,
  medicalComplete,
  onOpenSetup,
  onSelect,
  personalComplete,
  profile,
  progress,
  questionCount,
}: {
  readonly answeredQuestions: number;
  readonly documents: readonly BeautyDocsConsumerDocument[];
  readonly medicalComplete: boolean;
  readonly onOpenSetup: () => void;
  readonly onSelect: (section: ConsumerPortalSection) => void;
  readonly personalComplete: boolean;
  readonly profile: BeautyDocsConsumerProfile;
  readonly progress: number;
  readonly questionCount: number;
}) {
  const t = useT();
  const signedDocumentsCount = documents.filter(
    (document) => document.status === "SIGNED",
  ).length;
  const waitingDocumentsCount = documents.filter(
    (document) => document.status === "SUBMITTED",
  ).length;
  const tasks = [
    { complete: personalComplete, label: t("Dane osobowe"), section: "personal" as const, icon: UserRound },
    { complete: medicalComplete, label: t("Wywiad medyczny"), section: "medical" as const, icon: HeartPulse },
    { complete: profile.signatureConfigured, label: t("Własny podpis"), section: "signature" as const, icon: PenLine },
  ];
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] bg-[#245c4d] p-7 text-white shadow-[0_24px_70px_rgba(52,91,81,0.18)] sm:p-9">
        <div className="absolute -right-14 -top-20 size-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 right-32 size-56 rounded-full bg-[#d2e6b7]/20 blur-2xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_240px] lg:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em]">
              <ShieldCheck className="size-4" />{" "}{t("Twój bezpieczny profil")}
            </span>
            <h2 className="mt-5 max-w-2xl text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              {t("Uzupełnij dane raz, a kolejne wizyty zaczniesz szybciej.")}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
              {t("Dane, wywiad i podpis masz w jednym miejscu. Przed każdym zabiegiem nadal świadomie potwierdzisz aktualność informacji.")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#173d35] transition hover:-translate-y-0.5"
                onClick={() => onSelect("salons")}
                type="button"
              >
                {t("Znajdź salon")}{" "}<Search className="size-4" />
              </button>
              {progress < 100 ? (
                <button
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                  onClick={onOpenSetup}
                  type="button"
                >
                  {t("Dokończ profil")}{" "}<ChevronRight className="size-4" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
            <div className="flex items-end justify-between">
              <span className="text-sm font-bold text-white/70">{t("Gotowość profilu")}</span>
              <strong className="text-4xl font-black">{progress}%</strong>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
              <motion.div animate={{ width: `${progress}%` }} className="h-full bg-white" initial={false} />
            </div>
            <p className="mt-3 text-xs leading-5 text-white/60">{t("Im pełniejszy profil, tym mniej pól przy formularzu w salonie.")}</p>
          </div>
        </div>
      </section>

      <dl className="grid gap-4 sm:grid-cols-3">
        <DashboardStat
          description="kompletne dokumenty"
          icon={CheckCircle2}
          label={t("Podpisane formularze")}
          value={signedDocumentsCount}
        />
        <DashboardStat
          description={t("czekają na podpis salonu")}
          icon={Clock3}
          label={t("Oczekujące")}
          value={waitingDocumentsCount}
        />
        <DashboardStat
          description="wszystkie w historii"
          icon={FileText}
          label={t("Wszystkie formularze")}
          value={documents.length}
        />
      </dl>

      <div className="grid gap-4 md:grid-cols-3">
        {tasks.map((task) => {
          const Icon = task.icon;
          return (
            <button
              className="group rounded-3xl border border-[#e3e8dd] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#bccaa8] hover:shadow-md"
              key={task.section}
              onClick={() => onSelect(task.section)}
              type="button"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#eef3e6] text-[#245c4d]"><Icon className="size-5" /></span>
                <span className={`grid size-7 place-items-center rounded-full ${task.complete ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-400"}`}>
                  {task.complete ? <Check className="size-4" /> : <ChevronRight className="size-4" />}
                </span>
              </div>
              <h3 className="mt-5 font-black text-[#173d35]">{t(task.label)}</h3>
              <p className="mt-1 text-sm text-stone-500">{task.complete ? t("Uzupełnione") : t("Wymaga uzupełnienia")}</p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[28px] border border-[#e3e8dd] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#599687]">{t("Ostatnie dokumenty")}</p>
              <h2 className="mt-1 text-xl font-black">{t("Twoja historia")}</h2>
            </div>
            <button className="text-sm font-black text-[#245c4d]" onClick={() => onSelect("documents")} type="button">{t("Zobacz wszystkie")}</button>
          </div>
          <div className="mt-5 space-y-3">
            {documents.slice(0, 3).map((document) => (
              <div className="flex items-center gap-4 rounded-2xl bg-[#f8faf6] p-4" key={document.submissionId}>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#245c4d]"><FileText className="size-5" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{document.formName}</p><p className="truncate text-xs text-stone-500">{document.salonName}</p></div>
                <span className="text-xs font-bold text-stone-400">{formatShortDate(document.signedAt ?? document.sharedAt)}</span>
              </div>
            ))}
            {documents.length === 0 ? <p className="rounded-2xl border border-dashed border-[#d7ddce] px-4 py-8 text-center text-sm text-stone-500">{t("Pierwszy podpisany formularz pojawi się tutaj.")}</p> : null}
          </div>
        </section>
        <section className="rounded-[28px] border border-[#e3e8dd] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <span className="grid size-11 place-items-center rounded-2xl bg-[#edf2e6] text-[#245c4d]"><Activity className="size-5" /></span>
            <span className="rounded-full bg-[#f4f7f1] px-3 py-1 text-xs font-black text-[#508074]">{answeredQuestions}/{questionCount || "…"}</span>
          </div>
          <h2 className="mt-5 font-sans text-xl font-black">{t("Wywiad medyczny")}</h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">{t("Odpowiedzi zapisujesz raz i aktualizujesz wtedy, gdy coś się zmieni.")}</p>
          <button className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#245c4d]" onClick={() => onSelect("medical")} type="button">{t("Przejdź do wywiadu")}{" "}<ChevronRight className="size-4" /></button>
        </section>
      </div>
    </div>
  );
}

function DashboardStat({
  description,
  icon: Icon,
  label,
  value,
}: {
  readonly description: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: number;
}) {
  const t = useT();
  return (
    <div className="rounded-3xl border border-[#e3e8dd] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <dt className="text-sm font-black text-[#566858]">{t(label)}</dt>
        <span className="grid size-10 place-items-center rounded-2xl bg-[#eef3e6] text-[#245c4d]">
          <Icon className="size-4.5" />
        </span>
      </div>
      <dd className="mt-4 text-4xl font-black tracking-[-0.04em] text-[#173d35]">
        {value.toLocaleString(activeIntlLocale())}
      </dd>
      <p className="mt-1 text-xs text-stone-500">{t(description)}</p>
    </div>
  );
}

function ConsumerSalonDirectory({
  documents,
  initialBookFormCode,
  initialBookSlug,
  onGoToProfile,
  onStartChat,
  phoneReady,
  profile,
}: {
  readonly documents: readonly BeautyDocsConsumerDocument[];
  readonly initialBookFormCode: string | null;
  readonly initialBookSlug: string | null;
  readonly onGoToProfile: () => void;
  readonly onStartChat: (salon: { slug: string; displayName: string }) => void;
  readonly phoneReady: boolean;
  readonly profile: BeautyDocsConsumerProfile;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [salons, setSalons] = useState<readonly BeautyDocsConsumerSalon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingSalon, setBookingSalon] =
    useState<BeautyDocsConsumerSalon | null>(null);
  const [initialFormCode, setInitialFormCode] = useState<string | null>(null);
  const [resolvingBookSlug, setResolvingBookSlug] = useState(
    Boolean(initialBookSlug),
  );
  const [bookSlugError, setBookSlugError] = useState<string | null>(null);

  // A booking deep link ("Umów wizytę" on the salon's own public page) skips
  // the directory search entirely and opens the booking dialog straight away.
  useEffect(() => {
    if (!initialBookSlug) return;
    const controller = new AbortController();
    setResolvingBookSlug(true);
    setBookSlugError(null);
    void (async () => {
      try {
        const response = await fetch(
          `/api/beautydocs-preview/consumer/salons?slug=${encodeURIComponent(initialBookSlug)}`,
          { cache: "no-store", credentials: "same-origin", signal: controller.signal },
        );
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as BeautyDocsConsumerSalonList;
        const salon = body.items[0];
        if (!salon) {
          setBookSlugError(
            t("Nie znaleźliśmy tego salonu albo nie udostępnia teraz rezerwacji online."),
          );
          return;
        }
        // Only honor the requested form if the salon actually offers it —
        // otherwise fall back to the dialog's own default (its first form).
        setInitialFormCode(
          initialBookFormCode &&
            salon.activeForms.some((form) => form.code === initialBookFormCode)
            ? initialBookFormCode
            : null,
        );
        setBookingSalon(salon);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          return;
        }
        setBookSlugError(t("Nie udało się otworzyć rezerwacji. Spróbuj ponownie."));
      } finally {
        if (!controller.signal.aborted) setResolvingBookSlug(false);
      }
    })();
    return () => controller.abort();
  }, [initialBookFormCode, initialBookSlug, t]);
  const recentSalons = useMemo(() => {
    const unique = new Map<string, string>();
    for (const document of documents) {
      if (!unique.has(document.tenantSlug)) {
        unique.set(document.tenantSlug, document.salonName);
      }
    }
    return Array.from(unique, ([slug, displayName]) => ({ slug, displayName })).slice(0, 4);
  }, [documents]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const search = query.trim()
            ? `?query=${encodeURIComponent(query.trim())}`
            : "";
          const response = await fetch(
            `/api/beautydocs-preview/consumer/salons${search}`,
            {
              cache: "no-store",
              credentials: "same-origin",
              signal: controller.signal,
            },
          );
          if (!response.ok) throw new Error(String(response.status));
          const body = (await response.json()) as BeautyDocsConsumerSalonList;
          setSalons(Array.isArray(body.items) ? body.items : []);
        } catch (requestError) {
          if (requestError instanceof DOMException && requestError.name === "AbortError") {
            return;
          }
          setError(t("Nie udało się pobrać salonów. Spróbuj ponownie za chwilę."));
          setSalons([]);
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }, query.trim() ? 280 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, t]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {resolvingBookSlug ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-[#d7dfcc] bg-white/95 px-4 py-3 text-sm font-bold text-[#45766a]">
          <LoaderCircle className="size-4 animate-spin" />{" "}{t("Otwieramy rezerwację dla Ciebie…")}
        </div>
      ) : null}
      {bookSlugError ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {bookSlugError}
        </div>
      ) : null}
      <section className="relative overflow-hidden rounded-[28px] border border-[#d7dfcc] bg-[#edf2e5] p-5 shadow-[0_16px_42px_rgba(57,94,85,0.08)] sm:p-7">
        <div className="absolute -right-16 -top-16 size-52 rounded-full bg-white/35 blur-2xl" />
        <div className="relative">
          <span className="grid size-11 place-items-center rounded-2xl bg-white text-[#245c4d] shadow-sm">
            <Search className="size-5" />
          </span>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-[#629488]">{t("Katalog BeautyDocs")}</p>
          <h2 className="mt-1 font-sans text-2xl font-black tracking-[-0.03em] text-[#173d35] sm:text-3xl">{t("Znajdź miejsce dla siebie.")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5d7260]">{t("Poznaj salony, zobacz zdjęcia i odkryj ich ofertę. Szukaj po nazwie, mieście albo zabiegu.")}</p>
          <label className="relative mt-6 block max-w-2xl">
            <span className="sr-only">{t("Szukaj salonu, miasta lub zabiegu")}</span>
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#7a9c7f]" />
            <input
              autoComplete="off"
              className="min-h-14 w-full rounded-2xl border border-white/80 bg-white/90 py-3 pl-12 pr-11 text-sm font-semibold text-[#173d35] shadow-[0_8px_24px_rgba(52,84,76,0.08)] outline-none transition placeholder:text-stone-400 focus:border-[#aabc92] focus:bg-white focus:ring-4 focus:ring-white/50"
              maxLength={100}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("Np. Warszawa, laminacja brwi…")}
              value={query}
            />
            {query ? (
              <button
                aria-label={t("Wyczyść wyszukiwanie")}
                className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-stone-400 transition hover:bg-[#eff4e9] hover:text-[#173d35]"
                onClick={() => setQuery("")}
                type="button"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </label>
        </div>
      </section>

      {recentSalons.length > 0 && !query.trim() ? (
        <section className="rounded-[24px] border border-[#e3e8dd] bg-white/95 p-5 shadow-sm sm:p-6">
          <div>
            <p className="font-sans text-sm font-black text-[#173d35]">{t("Moje salony")}</p>
            <p className="mt-1 text-xs text-stone-500">{t("Salony powiązane z Twoją historią dokumentów.")}</p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {recentSalons.map((salon) => (
              <div className="flex items-center gap-1 rounded-2xl border border-[#eaeee5] bg-[#f9faf7] p-1.5 transition hover:border-[#cbd5bc] hover:bg-white" key={salon.slug}>
                <Link
                  className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2"
                  href={`/f/${encodeURIComponent(salon.slug)}?from=consumer`}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#245c4d] shadow-sm"><Building2 className="size-4" /></span>
                  <span className="min-w-0 flex-1 truncate text-sm font-black text-[#2a382c]">{salon.displayName}</span>
                  <ChevronRight className="size-4 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-[#245c4d]" />
                </Link>
                <button
                  aria-label={t("Napisz do {displayName}", { displayName: salon.displayName })}
                  className="grid size-10 shrink-0 place-items-center rounded-xl text-[#245c4d] transition hover:bg-[#ebf1e3]"
                  onClick={() => onStartChat(salon)}
                  type="button"
                >
                  <MessageCircle className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-live="polite" className="rounded-[26px] border border-[#e3e8dd] bg-white/95 p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-4 border-b border-[#ebeee6] pb-4">
          <div>
            <h3 className="font-sans text-sm font-black text-[#173d35]">{query.trim() ? t("Wyniki wyszukiwania") : t("Dostępne salony")}</h3>
            <p className="mt-1 text-xs text-stone-500">{t("Pokazujemy tylko salony z aktywnymi formularzami online.")}</p>
          </div>
          {!loading && !error ? <span className="rounded-full bg-[#f3f6ef] px-3 py-1.5 text-xs font-black text-[#508074]">{salons.length}</span> : null}
        </div>

        {loading ? (
          <div className="grid min-h-52 place-items-center text-sm font-semibold text-stone-500"><span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin text-[#245c4d]" />{" "}{t("Szukamy salonów…")}</span></div>
        ) : error ? (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-5 py-8 text-center text-sm font-semibold text-red-800">{error}</div>
        ) : salons.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#d9ded1] bg-[#fafbf8] px-5 py-10 text-center">
            <Building2 className="mx-auto size-6 text-[#8ab5aa]" />
            <p className="mt-3 text-sm font-black text-[#2a382c]">{t("Nie znaleźliśmy pasującego salonu")}</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-stone-500">{t("Spróbuj wpisać samo miasto, nazwę zabiegu albo krótszą nazwę salonu.")}</p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {salons.map((salon) => (
              <SalonDirectoryCard
                key={salon.slug}
                onBook={(formCode) => {
                  setInitialFormCode(formCode);
                  setBookingSalon(salon);
                }}
                onChat={() => onStartChat({ slug: salon.slug, displayName: salon.displayName })}
                salon={salon}
              />
            ))}
          </div>
        )}
      </section>
      <AnimatePresence>
        {bookingSalon ? (
          <AppointmentBookingDialog
            initialFormCode={initialFormCode}
            onClose={() => {
              setBookingSalon(null);
              setInitialFormCode(null);
            }}
            onGoToProfile={onGoToProfile}
            phoneReady={phoneReady}
            profile={profile}
            salon={bookingSalon}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SalonDirectoryCard({
  onBook,
  onChat,
  salon,
}: {
  readonly onBook: (formCode: string | null) => void;
  readonly onChat: () => void;
  readonly salon: BeautyDocsConsumerSalon;
}) {
  const t = useT();
  const location = [salon.postalCode, salon.city].filter(Boolean).join(" ");
  return (
    <article className="rounded-[20px] border border-[#e7ebe2] bg-[#f9faf8] p-4 transition hover:border-[#ccd6bf] hover:bg-white sm:p-5">
      <Link className="bd-consumer-salon-cover" href={`/salony/${salon.slug}`} aria-label={t("Poznaj salon {displayName}", { displayName: salon.displayName })}>{salon.coverUrl ? <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={salon.coverUrl} alt={salon.displayName} loading="lazy" />
      </> : <span>{salon.displayName.slice(0, 1)}</span>}</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#ebf1e3] text-[#245c4d]"><SalonLogo url={salon.logoUrl ?? null} name={salon.displayName} /></span>
          <div className="min-w-0">
            <h4 className="font-sans text-lg font-semibold tracking-tight text-[#173d35]"><Link href={`/salony/${salon.slug}`}>{salon.displayName} ↗</Link></h4>
            {salon.introduction && <p className="mt-2 text-sm leading-6 text-[#637163]">{salon.introduction}</p>}
            {salon.startingPrice != null && <p className="mt-2 text-sm font-semibold text-[#173d35]">{t("Usługi od")}{" "}{(salon.startingPrice / 100).toLocaleString(activeIntlLocale())}{" "}{t("zł")}</p>}
            {location || salon.addressLine1 ? (
              <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-stone-500"><MapPin className="mt-0.5 size-3.5 shrink-0" /> {[salon.addressLine1, location].filter(Boolean).join(", ")}</p>
            ) : null}
            {salon.phone ? <p className="mt-1 text-xs font-semibold text-stone-500">{salon.phone}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[#d2dac6] bg-white px-3.5 text-xs font-black text-[#173d35] transition hover:bg-[#f0f5e9]"
            onClick={onChat}
            type="button"
          >
            {t("Napisz")}{" "}<MessageCircle className="size-3.5" />
          </button>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#245c4d] px-4 text-xs font-black text-white transition hover:bg-[#173d35]"
            onClick={() => onBook(null)}
            type="button"
          >
            {t("Umów wizytę")}{" "}<CalendarDays className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-[#ebeee6] pt-4">
        {salon.activeForms.slice(0, 5).map((form) => (
          <button
            className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#173d35] shadow-sm ring-1 ring-[#e2e7da] transition hover:bg-[#245c4d] hover:text-white hover:ring-[#245c4d]"
            key={form.code}
            onClick={() => onBook(form.code)}
            type="button"
          >
            {form.displayName}
          </button>
        ))}
        {salon.activeForms.length > 5 ? <span className="self-center px-2 text-xs font-bold text-stone-400">+{salon.activeForms.length - 5}{" "}{t("więcej")}</span> : null}
      </div>
    </article>
  );
}

function AppointmentBookingDialog({
  initialFormCode,
  onClose,
  onGoToProfile,
  phoneReady,
  profile,
  salon,
}: {
  readonly initialFormCode: string | null;
  readonly onClose: () => void;
  readonly onGoToProfile: () => void;
  readonly phoneReady: boolean;
  readonly profile: BeautyDocsConsumerProfile;
  readonly salon: BeautyDocsConsumerSalon;
}) {
  const t = useT();
  const [today] = useState(() => bookingToday());
  const [formCode, setFormCode] = useState(
    initialFormCode ?? salon.activeForms[0]?.code ?? "",
  );
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(today));
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(today));
  const [monthAvailability, setMonthAvailability] =
    useState<BeautyDocsConsumerAppointmentMonthAvailability | null>(null);
  const [availability, setAvailability] =
    useState<BeautyDocsConsumerAppointmentAvailability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] =
    useState<BeautyDocsConsumerAppointmentCreated | null>(null);
  const reduceMotion = useReducedMotion();
  // Critically damped spring (bounce 0) so the sheet materializes rather than
  // just fades in — falls back to a quick cross-fade under reduced motion.
  const sheetMotion = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15, ease: "easeOut" as const },
      }
    : {
        initial: { opacity: 0, y: 24, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 20, scale: 0.98 },
        transition: { type: "spring" as const, bounce: 0, duration: 0.35 },
      };
  const maxBookingDate = useMemo(() => addBookingDays(today, 365), [today]);
  const calendarDays = useMemo(
    () => bookingMonthCalendarDays(calendarMonth),
    [calendarMonth],
  );
  const availableSlotsByDate = useMemo(
    () =>
      new Map(
        (monthAvailability?.days ?? []).map((day) => [
          day.date,
          day.availableSlots,
        ]),
      ),
    [monthAvailability],
  );

  useEffect(() => {
    if (!phoneReady || !formCode || created) return;
    const controller = new AbortController();
    const requestedMonth = bookingMonthKey(calendarMonth);
    setCalendarLoading(true);
    setMonthAvailability(null);
    setSelectedSlot(null);
    void fetch(
      `/api/beautydocs-preview/consumer/salons/${encodeURIComponent(salon.slug)}` +
        `/availability?formCode=${encodeURIComponent(formCode)}` +
        `&month=${encodeURIComponent(requestedMonth)}`,
      {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const body =
          (await response.json()) as BeautyDocsConsumerAppointmentMonthAvailability;
        setMonthAvailability(body);
        setSelectedDate((current) => {
          const currentDay = body.days.find((day) => day.date === current);
          if (currentDay?.availableSlots) return current;
          return body.days.find((day) => day.availableSlots > 0)?.date ?? current;
        });
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          return;
        }
        setMonthAvailability(null);
        setError(t("Nie udało się pobrać kalendarza salonu. Spróbuj ponownie."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setCalendarLoading(false);
      });
    return () => controller.abort();
  }, [calendarMonth, created, formCode, phoneReady, salon.slug, t]);

  useEffect(() => {
    if (!phoneReady || !formCode || !selectedDate || created) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setSelectedSlot(null);
    void fetch(
      `/api/beautydocs-preview/consumer/salons/${encodeURIComponent(salon.slug)}` +
        `/availability?formCode=${encodeURIComponent(formCode)}` +
        `&date=${encodeURIComponent(selectedDate)}`,
      {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        setAvailability(
          (await response.json()) as BeautyDocsConsumerAppointmentAvailability,
        );
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          return;
        }
        setAvailability(null);
        setError(t("Nie udało się pobrać wolnych godzin. Spróbuj ponownie."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [created, formCode, phoneReady, salon.slug, selectedDate, t]);

  const book = async () => {
    if (!selectedSlot || booking) return;
    setBooking(true);
    setError(null);
    try {
      const response = await fetch("/api/beautydocs-preview/consumer/appointments", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantSlug: salon.slug,
          formCode,
          startsAt: selectedSlot,
        }),
      });
      if (!response.ok) {
        if (response.status === 409) {
          setError(
            t("Ta godzina została właśnie zajęta albo profil nie ma potwierdzonego numeru telefonu."),
          );
          return;
        }
        throw new Error(String(response.status));
      }
      setCreated((await response.json()) as BeautyDocsConsumerAppointmentCreated);
    } catch {
      setError(t("Nie udało się zapisać wizyty. Spróbuj ponownie."));
    } finally {
      setBooking(false);
    }
  };

  const form = salon.activeForms.find((item) => item.code === formCode);
  const selectedDateLabel = formatBookingSelectedDate(selectedDate);

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[80] grid items-end bg-[#173d35]/50 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.section
        {...sheetMotion}
        aria-labelledby="booking-dialog-title"
        aria-modal="true"
        className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-[30px] bg-[#fdfffb] p-5 shadow-2xl sm:rounded-[30px] sm:p-7"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#599687]">
              {t("Rezerwacja online")}
            </p>
            <h2
              className="mt-1 text-2xl font-black tracking-[-0.03em] text-[#173d35]"
              id="booking-dialog-title"
            >
              {salon.displayName}
            </h2>
          </div>
          <button
            aria-label={t("Zamknij rezerwację")}
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#e2e7da] text-stone-500 transition hover:bg-[#f2f6ed]"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        {!phoneReady ? (
          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <Smartphone className="size-6 text-amber-700" />
            <h3 className="mt-4 font-black text-amber-950">
              {t("Potwierdź numer telefonu przed rezerwacją")}
            </h3>
            <p className="mt-2 text-sm leading-6 text-amber-900/75">
              {t("Salon użyje numeru do identyfikacji wizyty, a formularz do bezpiecznego potwierdzenia podpisu kodem SMS.")}
            </p>
            <button
              className="mt-5 rounded-2xl bg-amber-800 px-5 py-3 text-sm font-black text-white"
              onClick={() => {
                onClose();
                onGoToProfile();
              }}
              type="button"
            >
              {t("Uzupełnij numer telefonu")}
            </button>
          </div>
        ) : created ? (
          <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-600 text-white">
              <Check className="size-7" />
            </span>
            <h3 className="mt-5 text-xl font-black text-emerald-950">
              {t("Wizyta została zarezerwowana")}
            </h3>
            <p className="mt-2 text-sm leading-6 text-emerald-900/75">
              {formatAppointmentDate(created.startsAt)} · {created.formName}
            </p>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-stone-600">
              {t("Teraz wypełnij formularz przypisany do wizyty. Po jego podpisaniu salon zobaczy komplet dokumentów przy tym terminie.")}
            </p>
            <Link
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#245c4d] px-5 py-3 text-sm font-black text-white transition hover:bg-[#173d35]"
              href={appointmentFormHref(created)}
            >
              {t("Przejdź do formularza")}{" "}<ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div>
              <BookingStepLabel number="1" title={t("Wybierz rodzaj formularza")} />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {salon.activeForms.map((item) => (
                  <button
                    className={`rounded-2xl border p-4 text-left text-sm font-black transition ${
                      formCode === item.code
                        ? "border-[#245c4d] bg-[#f0f5e9] text-[#45766a] ring-2 ring-[#245c4d]/10"
                        : "border-[#e3e8dd] bg-white text-[#2a382c] hover:border-[#c5d1b4]"
                    }`}
                    key={item.code}
                    onClick={() => setFormCode(item.code)}
                    type="button"
                  >
                    {item.displayName}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
              <div>
                <BookingStepLabel number="2" title={t("Wybierz dzień w kalendarzu")} />
                <div className="mt-3 overflow-hidden rounded-3xl border border-[#e2e7da] bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-[#eaeee5] bg-[#fafcf8] px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-9 place-items-center rounded-xl bg-[#eef3e7] text-[#245c4d]">
                        <CalendarDays className="size-4.5" />
                      </span>
                      <div>
                        <p className="text-sm font-black capitalize text-[#173d35]">
                          {formatBookingMonth(calendarMonth)}
                        </p>
                        <p className="text-[10px] font-bold text-stone-400">
                          {t("Zielona kropka oznacza wolne godziny")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        className="hidden rounded-lg px-2.5 py-2 text-[11px] font-black text-[#508074] transition hover:bg-[#edf2e5] disabled:opacity-40 sm:block"
                        disabled={isSameBookingMonth(calendarMonth, today)}
                        onClick={() => {
                          setCalendarMonth(startOfMonth(today));
                          setSelectedDate(localDateKey(today));
                        }}
                        type="button"
                      >
                        {t("Dzisiaj")}
                      </button>
                      <button
                        aria-label={t("Poprzedni miesiąc")}
                        className="grid size-9 place-items-center rounded-xl border border-[#e2e7da] bg-white text-[#173d35] transition hover:border-[#bdcbaa] disabled:cursor-not-allowed disabled:opacity-35"
                        disabled={!canShowPreviousBookingMonth(calendarMonth, today)}
                        onClick={() => {
                          const previous = addBookingMonths(calendarMonth, -1);
                          setCalendarMonth(previous);
                          setSelectedDate(
                            localDateKey(
                              isSameBookingMonth(previous, today) ? today : previous,
                            ),
                          );
                        }}
                        type="button"
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      <button
                        aria-label={t("Następny miesiąc")}
                        className="grid size-9 place-items-center rounded-xl border border-[#e2e7da] bg-white text-[#173d35] transition hover:border-[#bdcbaa] disabled:cursor-not-allowed disabled:opacity-35"
                        disabled={!canShowNextBookingMonth(calendarMonth, maxBookingDate)}
                        onClick={() => {
                          const next = addBookingMonths(calendarMonth, 1);
                          setCalendarMonth(next);
                          setSelectedDate(localDateKey(next));
                        }}
                        type="button"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 border-b border-[#edf0e8] bg-[#fcfaf8] px-2 py-2 sm:px-3">
                    {BOOKING_WEEKDAYS.map((weekday) => (
                      <span
                        className="py-1 text-center text-[9px] font-black uppercase tracking-[0.1em] text-stone-400"
                        key={weekday}
                      >
                        {weekday}
                      </span>
                    ))}
                  </div>

                  <div className="relative grid grid-cols-7 gap-1 p-2 sm:gap-1.5 sm:p-3">
                    {calendarLoading ? (
                      <div className="absolute inset-0 z-10 grid place-items-center bg-white/75 backdrop-blur-[1px]">
                        <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-500 shadow-lg">
                          <LoaderCircle className="size-3.5 animate-spin text-[#245c4d]" />
                          {t("Sprawdzamy terminy…")}
                        </span>
                      </div>
                    ) : null}
                    {calendarDays.map((day) => {
                      const dayKey = localDateKey(day);
                      const inCurrentMonth = isSameBookingMonth(day, calendarMonth);
                      const withinRange =
                        compareBookingDates(day, today) >= 0 &&
                        compareBookingDates(day, maxBookingDate) <= 0;
                      const availableSlots = availableSlotsByDate.get(dayKey) ?? 0;
                      const disabled =
                        !inCurrentMonth ||
                        !withinRange ||
                        calendarLoading ||
                        availableSlots === 0;
                      const selected = selectedDate === dayKey;
                      return (
                        <button
                          aria-label={`${formatBookingSelectedDate(dayKey)}${availableSlots ? `, ${availableSlots} wolnych godzin` : ", brak wolnych godzin"}`}
                          aria-pressed={selected}
                          className={`relative flex min-h-12 flex-col items-center justify-center rounded-xl border text-sm transition sm:min-h-14 ${
                            selected
                              ? "border-[#245c4d] bg-[#245c4d] font-black text-white shadow-md"
                              : disabled
                                ? "border-transparent bg-transparent text-stone-300"
                                : "border-transparent bg-[#f8faf6] font-black text-[#344937] hover:border-[#c0cdae] hover:bg-white"
                          }`}
                          disabled={disabled}
                          key={dayKey}
                          onClick={() => setSelectedDate(dayKey)}
                          type="button"
                        >
                          <span>{day.getDate()}</span>
                          {availableSlots > 0 && inCurrentMonth ? (
                            <span
                              className={`mt-1 size-1.5 rounded-full ${selected ? "bg-white" : "bg-emerald-500"}`}
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  {!calendarLoading &&
                  monthAvailability &&
                  monthAvailability.days.every((day) => day.availableSlots === 0) ? (
                    <p className="border-t border-[#eaeee5] bg-amber-50 px-4 py-3 text-center text-xs font-bold text-amber-900">
                      {t("W tym miesiącu nie ma wolnych terminów. Przejdź do następnego miesiąca.")}
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <BookingStepLabel number="3" title={t("Wybierz godzinę")} />
                <div className="mt-3 rounded-3xl border border-[#e2e7da] bg-[#fafcf8] p-4 sm:p-5">
                  <p className="font-black capitalize text-[#2a382c]">
                    {t(selectedDateLabel)}
                  </p>
                  {availability ? (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-stone-500">
                      <Clock3 className="size-3.5 text-[#245c4d]" />
                      {t("Czas zabiegu:")}{" "}{formatAppointmentDuration(availability.slotMinutes)}
                    </p>
                  ) : null}
                  <div className="mt-4 min-h-32">
                    {loading ? (
                      <p className="flex items-center gap-2 rounded-2xl bg-white px-4 py-6 text-sm font-semibold text-stone-500">
                        <LoaderCircle className="size-4 animate-spin text-[#245c4d]" />
                        {t("Sprawdzamy godziny…")}
                      </p>
                    ) : availability?.slots.length ? (
                      <div className="grid grid-cols-3 gap-2 lg:grid-cols-2 xl:grid-cols-3">
                        {availability.slots.map((slot) => (
                          <button
                            className={`rounded-xl border px-3 py-2.5 text-sm font-black transition ${
                              selectedSlot === slot.startsAt
                                ? "border-[#245c4d] bg-[#245c4d] text-white"
                                : "border-[#e0e5d8] bg-white text-[#173d35] hover:border-[#aabc92]"
                            }`}
                            key={slot.startsAt}
                            onClick={() => setSelectedSlot(slot.startsAt)}
                            type="button"
                          >
                            {formatAppointmentTime(slot.startsAt)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-dashed border-[#d9dfd1] bg-white px-4 py-6 text-center text-sm leading-6 text-stone-500">
                        {t("Wybierz w kalendarzu dzień oznaczony zieloną kropką.")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {error ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-[#eaeee4] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-stone-500">
                {selectedSlot ? (
                  <>
                    <span className="font-black text-[#2a382c]">{form?.displayName}</span>
                    <span className="block text-xs">
                      {t(selectedDateLabel)}, {formatAppointmentTime(selectedSlot)} · {profile.fullName}
                    </span>
                  </>
                ) : (
                  t("Wybierz formularz, dzień i godzinę.")
                )}
              </div>
              <button
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#245c4d] px-6 text-sm font-black text-white transition hover:bg-[#173d35] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!selectedSlot || booking}
                onClick={() => void book()}
                type="button"
              >
                {booking ? <LoaderCircle className="size-4 animate-spin" /> : <CalendarDays className="size-4" />}
                {booking ? t("Rezerwujemy…") : t("Zarezerwuj wizytę")}
              </button>
            </div>
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}

function BookingStepLabel({ number, title }: { readonly number: string; readonly title: string }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-7 place-items-center rounded-full bg-[#eef3e7] text-xs font-black text-[#245c4d]">
        {number}
      </span>
      <h3 className="text-sm font-black text-[#173d35]">{t(title)}</h3>
    </div>
  );
}

const BOOKING_WEEKDAYS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Niedz"] as const;

function bookingToday(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "numeric",
    timeZone: "Europe/Warsaw",
    year: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    12,
  );
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1, 12);
}

function addBookingDays(value: Date, amount: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function addBookingMonths(value: Date, amount: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1, 12);
}

function startOfBookingWeek(value: Date): Date {
  const date = new Date(value);
  const weekday = date.getDay();
  date.setDate(date.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return date;
}

function bookingMonthCalendarDays(value: Date): readonly Date[] {
  const first = startOfBookingWeek(startOfMonth(value));
  return Array.from({ length: 42 }, (_, index) => addBookingDays(first, index));
}

function bookingMonthKey(value: Date): string {
  return localDateKey(startOfMonth(value)).slice(0, 7);
}

function isSameBookingMonth(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

function compareBookingDates(left: Date, right: Date): number {
  return localDateKey(left).localeCompare(localDateKey(right));
}

function canShowPreviousBookingMonth(month: Date, today: Date): boolean {
  return compareBookingDates(startOfMonth(month), startOfMonth(today)) > 0;
}

function canShowNextBookingMonth(month: Date, maxBookingDate: Date): boolean {
  return (
    compareBookingDates(
      addBookingMonths(startOfMonth(month), 1),
      startOfMonth(maxBookingDate),
    ) <= 0
  );
}

function parseBookingDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  return localDateKey(date) === value ? date : null;
}

function formatBookingMonth(value: Date): string {
  return new Intl.DateTimeFormat(activeIntlLocale(), {
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatBookingSelectedDate(value: string): string {
  const date = parseBookingDateKey(value);
  if (!date) return "Wybierz dzień";
  return new Intl.DateTimeFormat(activeIntlLocale(), {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  }).format(date);
}

function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAppointmentTime(value: string): string {
  return new Intl.DateTimeFormat(activeIntlLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function formatAppointmentDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (remainder === 0) return `${hours} godz.`;
  return `${hours} godz. ${remainder} min`;
}

function formatAppointmentDate(value: string): string {
  return new Intl.DateTimeFormat(activeIntlLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function appointmentFormHref(appointment: BeautyDocsConsumerAppointmentCreated): string {
  return (
    `/f/${encodeURIComponent(appointment.tenantSlug)}` +
    `/${encodeURIComponent(appointment.formCode)}?from=consumer` +
    `&appointment=${encodeURIComponent(appointment.id)}` +
    `&bookingToken=${encodeURIComponent(appointment.bookingToken)}`
  );
}

function ConsumerAppointmentsPanel({
  onSelect,
  onStartChat,
}: {
  readonly onSelect: (section: ConsumerPortalSection) => void;
  readonly onStartChat: (salon: { slug: string; displayName: string }) => void;
}) {
  const t = useT();
  const [appointments, setAppointments] =
    useState<readonly BeautyDocsConsumerAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/beautydocs-preview/consumer/appointments", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as {
        readonly items?: readonly BeautyDocsConsumerAppointment[];
      };
      setAppointments(Array.isArray(body.items) ? body.items : []);
    } catch {
      setError(t("Nie udało się pobrać Twoich wizyt."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = async (appointmentId: string) => {
    setPendingId(appointmentId);
    setError(null);
    try {
      const response = await fetch(
        `/api/beautydocs-preview/consumer/appointments/${encodeURIComponent(appointmentId)}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      if (!response.ok) throw new Error(String(response.status));
      await load();
    } catch {
      setError(t("Nie udało się anulować wizyty. Skontaktuj się z salonem."));
    } finally {
      setPendingId(null);
    }
  };

  const openForm = async (appointmentId: string) => {
    setPendingId(appointmentId);
    setError(null);
    try {
      const response = await fetch(
        `/api/beautydocs-preview/consumer/appointments/${encodeURIComponent(appointmentId)}/form-access`,
        { method: "POST", credentials: "same-origin" },
      );
      if (!response.ok) throw new Error(String(response.status));
      const access =
        (await response.json()) as BeautyDocsConsumerAppointmentFormAccess;
      window.location.assign(appointmentAccessHref(access));
    } catch {
      setError(t("Formularz tej wizyty nie jest teraz dostępny."));
      setPendingId(null);
    }
  };

  const [now] = useState(() => Date.now());
  const isUpcoming = (appointment: BeautyDocsConsumerAppointment) =>
    appointment.status === "PLANNED" &&
    new Date(appointment.startsAt).getTime() >= now;
  const upcoming = appointments
    .filter(isUpcoming)
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  // A booked slot only becomes "confirmed" once its consent form is signed —
  // there is no separate salon-side approval step, so this is what the
  // consumer actually needs to act on before their visit.
  const awaitingForm = upcoming.filter((appointment) => !appointment.formSubmitted);
  const confirmed = upcoming.filter((appointment) => appointment.formSubmitted);
  const completed = appointments
    .filter((appointment) => !isUpcoming(appointment))
    .sort(
      (a, b) =>
        new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
    );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-[#d7dfcc] bg-[#edf2e5] p-6 sm:p-7">
        <div className="absolute -right-12 -top-16 size-48 rounded-full bg-white/35 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <span className="grid size-11 place-items-center rounded-2xl bg-white text-[#245c4d] shadow-sm">
              <CalendarDays className="size-5" />
            </span>
            <h2 className="mt-5 text-2xl font-black tracking-[-0.03em] text-[#173d35]">
              {t("Terminy i formularze w jednym miejscu")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5d7260]">
              {t("Zarezerwuj wizytę, a następnie wypełnij przypisany do niej formularz.")}
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-2xl bg-[#245c4d] px-5 py-3 text-sm font-black text-white"
            onClick={() => onSelect("salons")}
            type="button"
          >
            <Search className="size-4" />{" "}{t("Znajdź salon")}
          </button>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid min-h-52 place-items-center rounded-[28px] border border-[#e3e8dd] bg-white text-sm font-semibold text-stone-500">
          <span className="flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin text-[#245c4d]" />{" "}{t("Ładujemy wizyty…")}
          </span>
        </div>
      ) : (
        <>
          <AppointmentCollection
            accent="amber"
            appointments={awaitingForm}
            delay={0}
            description={t("Termin jest zarezerwowany — brakuje jeszcze podpisanego formularza zabiegowego.")}
            empty={t("Świetnie, żadna wizyta nie czeka na formularz.")}
            icon={Hourglass}
            onCancel={cancel}
            onChat={(appointment) =>
              onStartChat({ slug: appointment.tenantSlug, displayName: appointment.salonName })
            }
            now={now}
            onOpenForm={openForm}
            pendingId={pendingId}
            title={t("Oczekujące na potwierdzenie")}
          />
          <AppointmentCollection
            accent="green"
            appointments={confirmed}
            delay={0.06}
            description={t("Formularz podpisany — zostało tylko przyjść na wizytę.")}
            empty={t("Nie masz jeszcze potwierdzonych wizyt.")}
            icon={CheckCircle2}
            onCancel={cancel}
            onChat={(appointment) =>
              onStartChat({ slug: appointment.tenantSlug, displayName: appointment.salonName })
            }
            now={now}
            onOpenForm={openForm}
            pendingId={pendingId}
            title={t("Gotowe (potwierdzone)")}
          />
          {completed.length ? (
            <AppointmentCollection
              accent="neutral"
              appointments={completed}
              delay={0.12}
              empty=""
              icon={History}
              onCancel={cancel}
              onChat={(appointment) =>
                onStartChat({ slug: appointment.tenantSlug, displayName: appointment.salonName })
              }
              now={now}
              onOpenForm={openForm}
              pendingId={pendingId}
              title={t("Zakończone")}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

const appointmentAccentStyles = {
  amber: { icon: "bg-amber-50 text-amber-600", count: "bg-amber-50 text-amber-700" },
  green: { icon: "bg-emerald-50 text-emerald-600", count: "bg-emerald-50 text-emerald-700" },
  neutral: { icon: "bg-stone-100 text-stone-500", count: "bg-stone-100 text-stone-600" },
} as const;

function AppointmentCollection({
  accent,
  appointments,
  delay = 0,
  description,
  empty,
  icon: Icon,
  onCancel,
  onChat,
  onOpenForm,
  now,
  pendingId,
  title,
}: {
  readonly accent: keyof typeof appointmentAccentStyles;
  readonly appointments: readonly BeautyDocsConsumerAppointment[];
  readonly delay?: number;
  readonly description?: string;
  readonly empty: string;
  readonly icon: LucideIcon;
  readonly onCancel: (id: string) => void;
  readonly onChat: (appointment: BeautyDocsConsumerAppointment) => void;
  readonly onOpenForm: (id: string) => void;
  readonly now: number;
  readonly pendingId: string | null;
  readonly title: string;
}) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const styles = appointmentAccentStyles[accent];
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[28px] border border-[#e3e8dd] bg-white p-5 shadow-sm sm:p-6"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      transition={
        reduceMotion
          ? { duration: 0.15, ease: "easeOut" }
          : { type: "spring", bounce: 0, duration: 0.4, delay }
      }
    >
      <div className="flex items-center gap-3 border-b border-[#ebeee6] pb-4">
        <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${styles.icon}`}>
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black text-[#173d35]">{t(title)}</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${styles.count}`}>
              {appointments.length}
            </span>
          </div>
          {description ? <p className="mt-0.5 text-xs text-stone-500">{t(description)}</p> : null}
        </div>
      </div>
      {appointments.length ? (
        <div className="mt-4 space-y-3">
          {appointments.map((appointment) => {
            const upcoming =
              appointment.status === "PLANNED" &&
              new Date(appointment.startsAt).getTime() > now;
            return (
              <article
                className="flex flex-col gap-4 rounded-2xl border border-[#eaeee5] bg-[#f9faf7] p-4 sm:flex-row sm:items-center"
                key={appointment.id}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-[#245c4d] shadow-sm">
                  <Clock3 className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-[#173d35]">{appointment.salonName}</p>
                  <p className="mt-1 text-sm text-stone-600">
                    {formatAppointmentDate(appointment.startsAt)}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">{appointment.formName}</p>
                  <p className="mt-1 text-[11px] leading-4 text-stone-400">
                    {t("Czat prowadzi zespół salonu; przy odpowiedzi zobaczysz imię rozmówcy.")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#ced7c1] bg-white px-3 py-2 text-xs font-black text-[#173d35] transition hover:bg-[#eef3e6]"
                    onClick={() => onChat(appointment)}
                    type="button"
                  >
                    <MessageCircle className="size-3.5" />{" "}{t("Napisz do salonu")}
                  </button>
                  {appointment.formSubmitted ? (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-700">
                      <Check className="size-3.5" />{" "}{t("Formularz gotowy")}
                    </span>
                  ) : upcoming ? (
                    <button
                      className="rounded-xl bg-[#245c4d] px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                      disabled={pendingId === appointment.id}
                      onClick={() => onOpenForm(appointment.id)}
                      type="button"
                    >
                      {t("Wypełnij formularz")}
                    </button>
                  ) : null}
                  {upcoming ? (
                    <button
                      className="rounded-xl border border-[#d9dfd1] bg-white px-3 py-2 text-xs font-black text-stone-600 disabled:opacity-50"
                      disabled={pendingId === appointment.id}
                      onClick={() => onCancel(appointment.id)}
                      type="button"
                    >
                      {t("Anuluj")}
                    </button>
                  ) : (
                    <span className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-black text-stone-500">
                      {appointment.status === "CANCELLED" ? t("Anulowana") : t("Zakończona")}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-[#d9dfd1] px-4 py-8 text-center text-sm text-stone-500">
          {empty}
        </p>
      )}
    </motion.section>
  );
}

function appointmentAccessHref(access: BeautyDocsConsumerAppointmentFormAccess): string {
  return (
    `/f/${encodeURIComponent(access.tenantSlug)}` +
    `/${encodeURIComponent(access.formCode)}?from=consumer` +
    `&appointment=${encodeURIComponent(access.appointmentId)}` +
    `&bookingToken=${encodeURIComponent(access.bookingToken)}`
  );
}

function PersonalDataPanel({
  onProfileChange,
  onSaved,
  profile,
}: {
  readonly onProfileChange: (state: BeautyDocsConsumerState) => void;
  readonly onSaved?: () => void;
  readonly profile: BeautyDocsConsumerProfile;
}) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? "");
  const [birthWarning, setBirthWarning] = useState<string | null>(() =>
    checkAdultBirthDate(profile.birthDate),
  );
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/beautydocs-preview/consumer/profile", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: String(form.get("fullName") ?? ""),
        email: String(form.get("email") ?? "") || null,
        birthDate: /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? birthDate : null,
        street: String(form.get("street") ?? "") || null,
        houseNumber: String(form.get("houseNumber") ?? "") || null,
        apartmentNumber: String(form.get("apartmentNumber") ?? "") || null,
        postalCode: String(form.get("postalCode") ?? "") || null,
        city: String(form.get("city") ?? "") || null,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      setMessage(t("Nie udało się zapisać danych. Sprawdź pola i spróbuj ponownie."));
      return;
    }
    onProfileChange((await response.json()) as BeautyDocsConsumerState);
    setMessage(t("Dane osobowe zostały zapisane."));
    onSaved?.();
  };
  return (
    <section className="overflow-hidden rounded-[30px] border border-[#e3e8dd] bg-white shadow-sm">
      <div className="border-b border-[#eaeee4] bg-gradient-to-r from-[#fcfff8] to-[#f2f7ec] p-6 sm:p-8">
        <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#e3ead9] text-[#245c4d]"><UserRound className="size-6" /></span><div><h2 className="text-2xl font-black tracking-tight">{t("Dane osobowe")}</h2><p className="mt-1 text-sm leading-6 text-stone-500">{t("Te informacje możemy podpowiedzieć w kolejnych formularzach. Zawsze sprawdzisz je przed wysłaniem.")}</p></div></div>
      </div>
      <form className="p-6 sm:p-8" onSubmit={save}>
        <div className="grid gap-5 sm:grid-cols-2">
          <ProfileInput defaultValue={profile.fullName} label={t("Imię i nazwisko")} name="fullName" required />
          <ProfileInput defaultValue={profile.email ?? ""} label={t("Adres e-mail")} name="email" required type="email" />
          <label className="block text-xs font-black uppercase tracking-[0.12em] text-stone-500 sm:col-span-2">
            {t("Data urodzenia")}
            <span className="mt-2 block">
              <BeautyDocsBirthDateField
                onChange={(value) => {
                  setBirthDate(value);
                  setBirthWarning(checkAdultBirthDate(value));
                }}
                value={birthDate}
              />
            </span>
            <input name="birthDate" type="hidden" value={birthDate} />
          </label>
          <ProfileInput className="sm:col-span-2" defaultValue={profile.street ?? ""} label={t("Ulica")} name="street" required />
          <ProfileInput defaultValue={profile.houseNumber ?? ""} label={t("Numer domu (opcjonalne)")} name="houseNumber" />
          <ProfileInput defaultValue={profile.apartmentNumber ?? ""} label={t("Numer mieszkania (opcjonalne)")} name="apartmentNumber" />
          <ProfileInput defaultValue={profile.postalCode ?? ""} label={t("Kod pocztowy")} name="postalCode" required />
          <ProfileInput defaultValue={profile.city ?? ""} label={t("Miejscowość")} name="city" required />
        </div>
        {birthWarning ? (
          <p className="mt-5 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800" role="status">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {birthWarning}
          </p>
        ) : null}
        {message ? <p className={`mt-5 rounded-2xl px-4 py-3 text-sm font-semibold ${message.startsWith("Nie") ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`} role="status">{t(message)}</p> : null}
        <div className="mt-6 flex justify-end"><button className="inline-flex min-w-48 items-center justify-center gap-2 rounded-2xl bg-[#245c4d] px-6 py-3.5 text-sm font-black text-white transition hover:bg-[#477d6f] disabled:opacity-60" disabled={saving} type="submit">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{" "}{t("Zapisz dane")}</button></div>
      </form>
      <div className="border-t border-[#eaeee4] p-6 sm:p-8">
        <PhoneVerificationField onProfileChange={onProfileChange} phone={profile.phone} />
      </div>
    </section>
  );
}

function ProfileInput({ className = "", defaultValue, label, name, onChange, required = false, type = "text" }: { readonly className?: string; readonly defaultValue: string; readonly label: string; readonly name: string; readonly onChange?: (value: string) => void; readonly required?: boolean; readonly type?: "date" | "email" | "text" }) {
  const t = useT();
  return <label className={`block text-xs font-black uppercase tracking-[0.12em] text-stone-500 ${className}`}>{t(label)}<input className={`${inputClass} mt-2 min-h-[50px] text-sm`} defaultValue={defaultValue} name={name} onChange={onChange ? (event) => onChange(event.target.value) : undefined} required={required} type={type} /></label>;
}

type PhoneFeedback = { readonly tone: "error" | "info" | "success"; readonly text: string };

function PhoneVerificationField({
  onProfileChange,
  phone,
}: {
  readonly onProfileChange: (state: BeautyDocsConsumerState) => void;
  readonly phone: string | null;
}) {
  const t = useT();
  const [mode, setMode] = useState<"editing" | "otp" | "view">(phone ? "view" : "editing");
  const [phoneInput, setPhoneInput] = useState(phone ?? "");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<BeautyDocsConsumerLoginChallenge | null>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<PhoneFeedback | null>(null);

  const sendCode = async () => {
    const trimmed = phoneInput.trim();
    if (trimmed.length < 8) {
      setFeedback({ tone: "error", text: t("Podaj prawidłowy numer telefonu.") });
      return;
    }
    setPending(true);
    setFeedback(null);
    let response: Response;
    try {
      response = await fetch("/api/beautydocs-preview/consumer/profile/phone", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: trimmed }),
      });
    } catch {
      setPending(false);
      setFeedback({ tone: "error", text: t("Nie udało się wysłać kodu. Spróbuj ponownie.") });
      return;
    }
    setPending(false);
    if (response.ok) {
      const data = (await response.json()) as BeautyDocsConsumerLoginChallenge;
      setChallenge(data);
      setCode("");
      setMode("otp");
      setFeedback({ tone: "info", text: t("Kod SMS wysłaliśmy na {destinationMasked}.", { destinationMasked: data.destinationMasked }) });
      return;
    }
    setFeedback({ tone: "error", text: phoneCodeError(response.status) });
  };

  const verify = async () => {
    if (challenge === null || !/^\d{6}$/.test(code)) {
      setFeedback({ tone: "error", text: t("Wpisz pełny, 6-cyfrowy kod SMS.") });
      return;
    }
    setPending(true);
    setFeedback(null);
    let response: Response;
    try {
      response = await fetch("/api/beautydocs-preview/consumer/profile/phone/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: phoneInput.trim(),
          challengeId: challenge.challengeId,
          code,
        }),
      });
    } catch {
      setPending(false);
      setFeedback({ tone: "error", text: t("Nie udało się potwierdzić kodu. Spróbuj ponownie.") });
      return;
    }
    setPending(false);
    if (response.ok) {
      onProfileChange((await response.json()) as BeautyDocsConsumerState);
      setChallenge(null);
      setCode("");
      setMode("view");
      setFeedback({ tone: "success", text: t("Numer telefonu został zweryfikowany.") });
      return;
    }
    setFeedback({ tone: "error", text: phoneVerifyError(response.status) });
  };

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e3ead9] text-[#245c4d]">
          <Smartphone className="size-5" />
        </span>
        <div>
          <h3 className="text-lg font-black tracking-tight">{t("Numer telefonu")}</h3>
          <p className="mt-1 text-sm leading-6 text-stone-500">
            {t("Potwierdzimy go kodem SMS. Zapiszemy go na Twoim koncie i podpowiemy w kolejnych formularzach.")}
          </p>
        </div>
      </div>

      {mode === "view" && phone ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d7ebdd] bg-[#f2faf4] px-4 py-3.5">
          <span className="flex items-center gap-2 text-sm font-black text-emerald-800">
            <ShieldCheck className="size-4" /> {phone}
          </span>
          <button
            className="text-sm font-bold text-[#245c4d] hover:underline"
            onClick={() => {
              setMode("editing");
              setPhoneInput(phone);
              setFeedback(null);
            }}
            type="button"
          >
            {t("Zmień numer")}
          </button>
        </div>
      ) : null}

      {mode === "editing" ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-xs font-black uppercase tracking-[0.12em] text-stone-500">
            {t("Numer telefonu")}
            <span className="mt-2 block">
              <BeautyDocsPhoneNumberField
                disabled={pending}
                onChange={setPhoneInput}
                value={phoneInput}
              />
            </span>
          </label>
          <div className="flex gap-2">
            {phone ? (
              <button
                className="inline-flex min-h-[50px] items-center justify-center rounded-2xl border border-[#d4decc] px-4 text-sm font-bold text-stone-600 transition hover:bg-stone-50"
                onClick={() => {
                  setMode("view");
                  setPhoneInput(phone);
                  setFeedback(null);
                }}
                type="button"
              >
                {t("Anuluj")}
              </button>
            ) : null}
            <button
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[#245c4d] px-5 text-sm font-black text-white transition hover:bg-[#477d6f] disabled:cursor-wait disabled:opacity-60"
              disabled={pending}
              onClick={sendCode}
              type="button"
            >
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
              {t("Wyślij kod SMS")}
            </button>
          </div>
        </div>
      ) : null}

      {mode === "otp" ? (
        <div className="mt-4">
          <button
            className="inline-flex items-center gap-2 text-sm font-bold text-[#245c4d]"
            onClick={() => {
              setMode("editing");
              setCode("");
              setFeedback(null);
            }}
            type="button"
          >
            <ArrowLeft className="size-4" />{" "}{t("Zmień numer")}
          </button>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              autoComplete="one-time-code"
              className={`${inputClass} min-h-[50px] flex-1 text-center text-2xl font-black tracking-[0.35em]`}
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              value={code}
            />
            <button
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[#245c4d] px-5 text-sm font-black text-white transition hover:bg-[#477d6f] disabled:cursor-wait disabled:opacity-60"
              disabled={pending}
              onClick={verify}
              type="button"
            >
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
              {t("Potwierdź")}
            </button>
          </div>
          {challenge?.devCode ? (
            <p className="mt-2 text-xs text-stone-500">{t("Kod testowy:")}{" "}{challenge.devCode}</p>
          ) : null}
        </div>
      ) : null}

      {feedback ? (
        <p
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
            feedback.tone === "error"
              ? "bg-red-50 text-red-800"
              : feedback.tone === "success"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-[#f2f7ec] text-[#477d6f]"
          }`}
          role="status"
        >
          {t(feedback.text)}
        </p>
      ) : null}
    </div>
  );
}

function phoneCodeError(status: number): string {
  if (status === 409) return "Ten numer jest już przypisany do innego konta.";
  if (status === 429) return "Kod został już wysłany. Odczekaj chwilę przed kolejną próbą.";
  if (status === 401) return "Twoja sesja wygasła. Odśwież stronę i zaloguj się ponownie.";
  if (status === 422) return "Podaj prawidłowy numer telefonu.";
  return "Nie udało się wysłać kodu. Spróbuj ponownie.";
}

function phoneVerifyError(status: number): string {
  if (status === 400) return "Kod jest nieprawidłowy lub wygasł. Sprawdź SMS i spróbuj ponownie.";
  if (status === 409) return "Ten numer jest już przypisany do innego konta.";
  if (status === 401) return "Twoja sesja wygasła. Odśwież stronę i zaloguj się ponownie.";
  return "Nie udało się potwierdzić kodu. Spróbuj ponownie.";
}

function MedicalInterviewPanel({
  catalog,
  onProfileChange,
  onSaved,
  profile,
}: {
  readonly catalog: BeautyDocsConsumerMedicalCatalog;
  readonly onProfileChange: (state: BeautyDocsConsumerState) => void;
  readonly onSaved?: () => void;
  readonly profile: BeautyDocsConsumerProfile;
}) {
  const t = useT();
  const [answers, setAnswers] = useState<
    Record<string, { answer: "yes" | "no"; followUp: string }>
  >(() => sanitizeMedicalAnswers(profile.medicalAnswers));
  const [search, setSearch] = useState("");
  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const formOptions = useMemo(() => Array.from(new Set(catalog.questions.flatMap(question => question.sourceForms))).sort((a, b) => a.localeCompare(b, "pl")), [catalog.questions]);
  const scopedQuestions = useMemo(() => selectedForms.length === 0 ? catalog.questions : catalog.questions.filter(question => question.sourceForms.some(form => selectedForms.includes(form))), [catalog.questions, selectedForms]);
  const changeForms = (forms: string[]) => { setSelectedForms(forms); setVisibleCount(18); setMessage(null); };
  const [visibleCount, setVisibleCount] = useState(18);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const filteredQuestions = useMemo(() => {
    const phrase = search.trim().toLocaleLowerCase("pl");
    if (!phrase) return scopedQuestions;
    return scopedQuestions.filter((question) => `${question.question} ${question.category ?? ""} ${question.sourceForms.join(" ")}`.toLocaleLowerCase("pl").includes(phrase));
  }, [scopedQuestions, search]);
  const answeredCount = scopedQuestions.filter((question) => answers[question.key]?.answer).length;
  const blockingQuestions = useMemo(
    () =>
      catalog.questions.filter(
        (question) =>
          isAbsoluteContraindication(question) &&
          answers[question.key]?.answer === "yes",
      ),
    [answers, catalog.questions],
  );
  const blockedForms = useMemo(
    () =>
      Array.from(
        new Set(blockingQuestions.flatMap((question) => question.sourceForms)),
      ).sort((left, right) => left.localeCompare(right, "pl")),
    [blockingQuestions],
  );
  const missingFollowUps = scopedQuestions.filter(
    (question) =>
      question.hasFollowUp &&
      answers[question.key]?.answer === "yes" &&
      !answers[question.key]?.followUp.trim(),
  );
  const save = async () => {
    if (missingFollowUps.length > 0) {
      setMessage(
        t("Nie można zapisać wywiadu — uzupełnij szczegóły przy {length} odpowiedzi{value2} „Tak”.", { length: missingFollowUps.length, value2: missingFollowUps.length === 1 ? "" : "ach" }),
      );
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      // The API merges supplied answers, preserving saved answers for other forms.
      const scopedKeys = new Set(scopedQuestions.map(question => question.key));
      const response = await fetch("/api/beautydocs-preview/consumer/profile/medical", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: Object.fromEntries(Object.entries(answers).filter(([key]) => scopedKeys.has(key))) }),
      });
      if (!response.ok) {
        setMessage(t("Nie udało się zapisać wywiadu. Spróbuj ponownie."));
        return;
      }
      onProfileChange((await response.json()) as BeautyDocsConsumerState);
      setMessage(selectedForms.length ? t("Odpowiedzi dla wybranych formularzy zostały zapisane.") : t("Wywiad został bezpiecznie zapisany."));
      onSaved?.();
    } catch {
      setMessage(t("Nie udało się zapisać wywiadu. Sprawdź połączenie i spróbuj ponownie."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="mx-auto max-w-5xl space-y-4">
      <div className="rounded-[26px] border border-[#e3e8dd] bg-white/95 p-5 shadow-[0_12px_36px_rgba(48,72,66,0.06)] sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#edf2e6] text-[#245c4d]">
              <HeartPulse className="size-5" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a9b8f]">{t("Profil zdrowotny")}</p>
              <h2 className="mt-1 font-sans text-xl font-black tracking-[-0.02em] text-[#173d35] sm:text-2xl">{t("Wywiad medyczny")}</h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-stone-500">{t("Odpowiedzi zapisujesz na swoim profilu. Przed każdym zabiegiem możesz je spokojnie przejrzeć i zaktualizować.")}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-[#f6f8f3] px-4 py-3 sm:min-w-44">
            <span className="grid size-8 place-items-center rounded-full bg-white text-[#245c4d] shadow-sm">
              <Check className="size-4" />
            </span>
            <span>
              <strong className="block text-sm font-black text-[#173d35]">{answeredCount}{" "}{t("z")}{" "}{scopedQuestions.length}</strong>
              <span className="block text-[11px] font-semibold text-stone-500">{t("udzielonych odpowiedzi")}</span>
            </span>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eaeee5]">
            <motion.div animate={{ width: `${scopedQuestions.length ? (answeredCount / scopedQuestions.length) * 100 : 0}%` }} className="h-full rounded-full bg-[#245c4d]" initial={false} />
          </div>
          <span className="text-xs font-black tabular-nums text-[#245c4d]">{scopedQuestions.length ? Math.round((answeredCount / scopedQuestions.length) * 100) : 0}%</span>
        </div>
      </div>

      {formOptions.length > 0 && (
        <fieldset className="rounded-[26px] border border-[#e3e8dd] bg-white p-5 sm:p-6" disabled={saving}>
          <legend className="sr-only">{t("Wybierz formularze do wywiadu")}</legend>
          <h3 className="text-sm font-semibold text-[#173d35]">{t("Do jakiego zabiegu się przygotowujesz?")}</h3>
          <p className="mt-2 text-sm leading-6 text-[#637163]">{t("Wybierz jeden lub kilka formularzy. Wspólne pytania wypełnisz tylko raz. Zmiana filtra zachowuje wpisane odpowiedzi.")}</p>
          <div className="mt-4 flex flex-wrap gap-2" aria-label={t("Filtry formularzy")} role="group">
            {[{ label: t("Wszystkie formularze"), value: null }, ...formOptions.map(form => ({ label: form, value: form }))].map(option => {
              const active = option.value === null ? selectedForms.length === 0 : selectedForms.includes(option.value);
              return <button key={option.value ?? "all"} type="button" aria-pressed={active} onClick={() => changeForms(option.value === null ? [] : active ? selectedForms.filter(form => form !== option.value) : [...selectedForms, option.value])}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2 active:opacity-80 disabled:opacity-60 ${active ? "border-[#245c4d] bg-[#245c4d] text-white" : "border-[#dce3d5] bg-[#f7f8f4] text-[#173d35] hover:bg-[#e8eedf]"}`}>
                <span aria-hidden="true" className={`grid size-4 shrink-0 place-items-center rounded border ${active ? "border-white/60" : "border-[#a5b299]"}`}>{active && <Check className="size-3" />}</span>{t(option.label)}
              </button>;
            })}
          </div>
          <p role="status" className="mt-4 text-xs leading-5 text-[#637163]">{selectedForms.length ? t("Wybrane formularze: {length}.", { length: selectedForms.length }) : t("Wszystkie formularze.")}{" "}{t("Liczba pytań:")}{" "}{scopedQuestions.length}{t(". Zapis dotyczy tego wyboru.")}</p>
        </fieldset>
      )}

      <AnimatePresence>
        {blockingQuestions.length > 0 ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[22px] border border-[#c3d6a9] bg-[#fafff4] p-4 text-[#2f6356] shadow-[0_10px_28px_rgba(36,92,77,0.08)] sm:p-5"
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: -8 }}
            role="alert"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#245c4d] text-white">
                <AlertTriangle className="size-[18px]" />
              </span>
              <div>
                <h3 className="font-sans text-sm font-black">{t("Wymagana konsultacja z salonem")}</h3>
                <p className="mt-1 text-sm leading-6 text-[#427468]">
                  {t("Zaznaczono")}{" "}{formatContraindicationCount(blockingQuestions.length)}{t(". Dotyczy to:")}{" "}{blockedForms.join(", ")}{t(". Ostateczną kwalifikację przeprowadza osoba wykonująca zabieg.")}
                </p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="rounded-[26px] border border-[#e3e8dd] bg-white/95 p-4 shadow-[0_12px_36px_rgba(48,72,66,0.05)] sm:p-6">
        <div className="flex flex-col gap-3 border-b border-[#ebeee6] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-sans text-sm font-black text-[#173d35]">{t("Pytania medyczne")}</h3>
            <p className="mt-1 text-xs leading-5 text-stone-500">{t("Wybierz „Tak” lub „Nie”. Jeśli potrzebujemy szczegółów, pokażemy dodatkowe pole.")}</p>
          </div>
          <label className="relative block sm:w-80">
            <span className="sr-only">{t("Szukaj w pytaniach medycznych")}</span>
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input className="w-full rounded-xl border border-[#dfe4d8] bg-[#f9faf7] py-3 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-[#6ba798] focus:bg-white focus:ring-4 focus:ring-[#245c4d]/10" onChange={(event) => { setSearch(event.target.value); setVisibleCount(18); }} placeholder={t("Szukaj pytania…")} value={search} />
          </label>
        </div>

        {missingFollowUps.length > 0 ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900" role="status">
            {t("Uzupełnij szczegóły przy odpowiedziach „Tak”:")}{" "}{missingFollowUps.length} {missingFollowUps.length === 1 ? "pole" : "pola"}.
          </p>
        ) : null}
        {catalog.questions.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-[#d6dccd] p-8 text-center text-sm text-stone-500"><LoaderCircle className="mx-auto mb-3 size-5 animate-spin text-[#245c4d]" />{t("Pobieramy aktualne pytania z bazy formularzy.")}</div> : null}
        <div className="mt-5 space-y-2.5">
          {filteredQuestions.slice(0, visibleCount).map((question, index) => (
            <MedicalQuestionCard
              answer={answers[question.key]}
              index={index + 1}
              key={question.key}
              isBlocking={
                isAbsoluteContraindication(question) &&
                answers[question.key]?.answer === "yes"
              }
              onChange={(answer) => setAnswers((current) => ({ ...current, [question.key]: answer }))}
              question={question}
            />
          ))}
        </div>
        {visibleCount < filteredQuestions.length ? <button className="mt-4 w-full rounded-xl border border-[#d9ded1] bg-white px-5 py-3 text-sm font-black text-[#508074] transition hover:bg-[#f8faf5]" onClick={() => setVisibleCount((value) => value + 18)} type="button">{t("Pokaż kolejne pytania (")}{filteredQuestions.length - visibleCount})</button> : null}
        {filteredQuestions.length === 0 && catalog.questions.length ? <p className="mt-5 rounded-2xl bg-stone-50 p-6 text-center text-sm text-stone-500">{t("Nie znaleziono pasującego pytania.")}</p> : null}
      </div>

      {message ? <p className={`rounded-2xl px-4 py-3 text-sm font-semibold ${message.startsWith("Nie") ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`} role="status">{t(message)}</p> : null}
      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-[#d9ded1] bg-white/90 p-3 shadow-[0_18px_50px_rgba(43,66,60,0.14)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="px-1">
          <p className="text-xs font-black text-[#173d35]">{t("Twoje odpowiedzi są prywatne")}</p>
          <p className="mt-0.5 text-[11px] text-stone-500">{t("Zapisz zmiany, aby były dostępne przy kolejnej wizycie.")}</p>
        </div>
        <button className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#245c4d] px-5 text-sm font-black text-white shadow-[0_8px_20px_rgba(36,92,77,0.22)] transition hover:bg-[#477d6f] disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || answeredCount === 0 || missingFollowUps.length > 0} onClick={() => void save()} type="button">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}{" "}{t("Zapisz wywiad")}</button>
      </div>
    </section>
  );
}

function MedicalQuestionCard({ answer, index, isBlocking, onChange, question }: { readonly answer: { answer: "yes" | "no"; followUp: string } | undefined; readonly index: number; readonly isBlocking: boolean; readonly onChange: (answer: { answer: "yes" | "no"; followUp: string }) => void; readonly question: BeautyDocsConsumerMedicalQuestion }) {
  const t = useT();
  return (
    <article className={`rounded-[18px] border p-3.5 transition sm:p-4 ${isBlocking ? "border-[#adc788] bg-[#fbfff5] shadow-[0_8px_22px_rgba(36,92,77,0.08)]" : answer?.answer ? "border-[#d8dfcd] bg-[#fcfdfa]" : "border-[#ebeee7] bg-[#f9faf8] hover:border-[#d6ddcd]"}`}>
      <div className="flex gap-3">
        <span className={`grid size-8 shrink-0 place-items-center rounded-xl text-[11px] font-black ${isBlocking ? "bg-[#245c4d] text-white" : answer?.answer ? "bg-white text-[#245c4d] shadow-sm" : "bg-[#edf0e9] text-[#245c4d]"}`}>{index}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold leading-6 text-[#2a382c]">{t(question.question)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {question.category ? <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${isAbsoluteContraindication(question) ? "bg-[#eaf1df] text-[#407b6c]" : "bg-stone-100 text-stone-500"}`}>{question.category}</span> : null}
                <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-[#245c4d] shadow-sm">{question.sourceForms.slice(0, 2).join(" · ")}</span>
              </div>
            </div>
            <div aria-label={t("Odpowiedź")} className="grid shrink-0 grid-cols-2 gap-1.5 sm:w-44" role="radiogroup">
              <MedicalChoice active={answer?.answer === "yes"} kind="yes" label={t("Tak")} onClick={() => onChange({ answer: "yes", followUp: answer?.followUp ?? "" })} />
              <MedicalChoice active={answer?.answer === "no"} kind="no" label={t("Nie")} onClick={() => onChange({ answer: "no", followUp: "" })} />
            </div>
          </div>
          {isBlocking ? <motion.p animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-start gap-2 rounded-xl border border-[#dbe7cb] bg-white/70 px-3.5 py-3 text-xs font-bold leading-5 text-[#3c7265]" initial={{ opacity: 0, y: -5 }} role="alert"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{t("To bezwzględne przeciwwskazanie. Zabieg wymaga ponownej kwalifikacji przez specjalistę.")}</motion.p> : null}
          {answer?.answer === "yes" && question.hasFollowUp ? <motion.label animate={{ opacity: 1, y: 0 }} className="mt-3 block text-[10px] font-black uppercase tracking-[0.12em] text-[#173d35]" initial={{ opacity: 0, y: -6 }}>{t("Doprecyzuj odpowiedź")}{" "}<span className="text-[#245c4d]">*</span><input aria-required="true" className="mt-2 w-full rounded-xl border border-[#cdd9bc] bg-white px-4 py-3 text-sm font-semibold normal-case tracking-normal text-[#173d35] outline-none transition focus:border-[#245c4d] focus:ring-4 focus:ring-[#245c4d]/10" onChange={(event) => onChange({ answer: "yes", followUp: event.target.value })} placeholder={question.followUpPlaceholder ?? t("Jeżeli tak, opisz…")} value={answer.followUp ?? ""} />{!answer.followUp.trim() ? <span className="mt-1.5 block text-[11px] font-bold normal-case tracking-normal text-[#4d9b87]">{t("Podaj szczegóły, aby można było zapisać wywiad.")}</span> : null}</motion.label> : null}
        </div>
      </div>
    </article>
  );
}

function MedicalChoice({ active, kind, label, onClick }: { readonly active: boolean; readonly kind: "yes" | "no"; readonly label: string; readonly onClick: () => void }) {
  const t = useT();
  const Icon = kind === "yes" ? Check : X;
  return <button aria-checked={active} className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2 ${active ? kind === "yes" ? "border-[#245c4d] bg-[#245c4d] text-white shadow-[0_5px_14px_rgba(36,92,77,0.18)]" : "border-[#b7cfc0] bg-[#edf7f0] text-[#28613d]" : "border-[#dfe3d9] bg-white text-stone-500 hover:border-[#c6d0b9] hover:text-[#173d35]"}`} onClick={onClick} role="radio" type="button"><Icon className="size-3.5 stroke-[2.5]" />{t(label)}</button>;
}

/* eslint-disable @next/next/no-img-element -- private image requires the browser session cookie. */
function ConsumerSignaturePanel({ onProfileChange, onSaved, profile }: { readonly onProfileChange: (state: BeautyDocsConsumerState) => void; readonly onSaved?: () => void; readonly profile: BeautyDocsConsumerProfile }) {
  const t = useT();
  const [editing, setEditing] = useState(!profile.signatureConfigured);
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshState = async () => {
    const response = await fetch("/api/beautydocs-preview/consumer/me", { cache: "no-store", credentials: "same-origin" });
    if (response.ok) onProfileChange((await response.json()) as BeautyDocsConsumerState);
  };
  const save = async () => {
    if (!signature) return;
    setSaving(true); setError(null);
    const response = await fetch("/api/beautydocs-preview/consumer/profile/signature", { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ signature }) });
    setSaving(false);
    if (!response.ok) { setError(t("Nie udało się zapisać podpisu. Narysuj go ponownie.")); return; }
    await refreshState(); setEditing(false); setSignature(""); onSaved?.();
  };
  const remove = async () => {
    setSaving(true); setError(null);
    const response = await fetch("/api/beautydocs-preview/consumer/profile/signature", { method: "DELETE", credentials: "same-origin" });
    setSaving(false);
    if (!response.ok) { setError(t("Nie udało się usunąć podpisu.")); return; }
    await refreshState(); setEditing(true); setSignature("");
  };
  return (
    <section className="mx-auto max-w-5xl space-y-4">
      <div className="rounded-[26px] border border-[#e3e8dd] bg-white/95 p-5 shadow-[0_12px_36px_rgba(48,72,66,0.06)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#edf2e6] text-[#245c4d]">
              <PenLine className="size-5" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a9b8f]">{t("Podpis elektroniczny")}</p>
              <h2 className="mt-1 font-sans text-xl font-black tracking-[-0.02em] text-[#173d35] sm:text-2xl">{t("Twój zapisany podpis")}</h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-stone-500">{t("Możesz użyć go przy kolejnych formularzach, ale za każdym razem samodzielnie zdecydujesz o jego dołączeniu.")}</p>
            </div>
          </div>
          <span className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${profile.signatureConfigured ? "bg-emerald-50 text-emerald-700" : "bg-[#f4f7f1] text-[#508074]"}`}>
            <span className={`size-2 rounded-full ${profile.signatureConfigured ? "bg-emerald-500" : "bg-[#8bb9ae]"}`} />
            {profile.signatureConfigured ? t("Podpis zapisany") : t("Do uzupełnienia")}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-[26px] border border-[#e3e8dd] bg-white/95 p-5 shadow-[0_12px_36px_rgba(48,72,66,0.05)] sm:p-6">
          {profile.signatureConfigured && !editing ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-sans text-sm font-black text-[#173d35]">{t("Aktualny podpis")}</p>
                  <p className="mt-1 text-xs text-stone-500">{t("Ostatnia aktualizacja:")}{" "}{profile.signatureUpdatedAt ? formatDate(profile.signatureUpdatedAt) : "brak daty"}</p>
                </div>
                <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Check className="size-[18px]" /></span>
              </div>
              <div className="relative mt-5 grid min-h-60 place-items-center overflow-hidden rounded-[22px] border border-[#e1e6da] bg-[#fafbf9] p-6">
                <div className="pointer-events-none absolute inset-x-6 bottom-12 border-t border-dashed border-[#d8decf]" />
                {/* Private authenticated image; the Next image optimizer cannot forward this session. */}
                <img alt={t("Twój zapisany podpis")} className="relative z-10 max-h-40 max-w-full object-contain" src={`/api/beautydocs-preview/consumer/profile/signature?v=${encodeURIComponent(profile.signatureUpdatedAt ?? "1")}`} />
              </div>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50" disabled={saving} onClick={() => void remove()} type="button"><Trash2 className="size-4" />{" "}{t("Usuń podpis")}</button>
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#245c4d] px-5 text-sm font-black text-white shadow-[0_8px_20px_rgba(36,92,77,0.2)] transition hover:bg-[#477d6f]" onClick={() => setEditing(true)} type="button"><PenLine className="size-4" />{" "}{t("Zmień podpis")}</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-5">
                <p className="font-sans text-sm font-black text-[#173d35]">{profile.signatureConfigured ? t("Zaktualizuj podpis") : t("Dodaj swój podpis")}</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">{t("Podpisz się palcem na telefonie albo kursorem na komputerze.")}</p>
              </div>
              <BeautyDocsSignaturePad label={t("Pole podpisu")} onChange={setSignature} required value={signature} />
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {profile.signatureConfigured ? <button className="min-h-11 rounded-xl border border-[#d9ded1] bg-white px-5 text-sm font-black text-[#508074] transition hover:bg-[#f8faf5]" onClick={() => { setEditing(false); setSignature(""); }} type="button">{t("Anuluj")}</button> : null}
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#245c4d] px-5 text-sm font-black text-white shadow-[0_8px_20px_rgba(36,92,77,0.2)] transition hover:bg-[#477d6f] disabled:cursor-not-allowed disabled:opacity-40" disabled={!signature || saving} onClick={() => void save()} type="button">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{" "}{t("Zapisz podpis")}</button>
              </div>
            </div>
          )}
          {error ? <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="status">{error}</p> : null}
        </div>

        <aside className="rounded-[26px] border border-[#dde3d4] bg-[#f1f5ec] p-5 sm:p-6">
          <span className="grid size-10 place-items-center rounded-2xl bg-white text-[#245c4d] shadow-sm"><ShieldCheck className="size-5" /></span>
          <h3 className="mt-5 font-sans text-base font-black text-[#173d35]">{t("Masz pełną kontrolę")}</h3>
          <p className="mt-2 text-sm leading-6 text-[#5f7662]">{t("Podpis jest widoczny tylko po zalogowaniu i nie trafia do publicznego profilu.")}</p>
          <div className="mt-5 space-y-3 border-t border-[#d7dfcc] pt-5">
            {[t("Nie dołączamy go automatycznie"), t("Każde użycie wymaga potwierdzenia"), t("Możesz go zmienić lub usunąć")].map((item) => (
              <div className="flex items-start gap-2.5" key={item}>
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white text-[#245c4d]"><Check className="size-3" /></span>
                <p className="text-xs font-semibold leading-5 text-[#4f6852]">{item}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
/* eslint-enable @next/next/no-img-element */

function ConsumerDocumentsPanel({ documents, onOpenDocument }: { readonly documents: readonly BeautyDocsConsumerDocument[]; readonly onOpenDocument: (id: string) => void }) {
  const t = useT();
  return (
    <section className="rounded-[30px] border border-[#e3e8dd] bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#e3ead9] text-[#245c4d]"><ClipboardCheck className="size-6" /></span><div><h2 className="text-2xl font-black">{t("Historia dokumentów")}</h2><p className="mt-1 text-sm text-stone-500">{t("Formularze powiązane z Twoim zweryfikowanym kontem.")}</p></div></div>
      <div className="mt-7 space-y-3">{documents.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d3dbc9] bg-[#fafbf8] px-5 py-12 text-center text-sm text-stone-500">{t("Nie masz jeszcze zapisanych dokumentów.")}</div> : documents.map((document) => <button className="flex w-full flex-col gap-3 rounded-2xl border border-[#e5eadf] p-5 text-left transition hover:border-[#88b8ac] hover:bg-[#fafcf8] sm:flex-row sm:items-center sm:justify-between" key={document.submissionId} onClick={() => onOpenDocument(document.submissionId)} type="button"><span className="flex items-center gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eef3e7] text-[#245c4d]"><FileText className="size-5" /></span><span><span className="block font-black">{document.formName}</span><span className="mt-1 block text-sm text-stone-500">{document.salonName} · {formatDate(document.signedAt ?? document.sharedAt)}</span></span></span><span className={`self-start rounded-full px-3 py-1 text-xs font-black sm:self-auto ${document.status === "SIGNED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{t(consumerDocumentStatusLabel(document.status))}</span></button>)}</div>
    </section>
  );
}

interface ConsumerInboxMessage {
  readonly id: string;
  readonly submissionId: string;
  readonly title: string;
  readonly body: string;
  readonly salonName: string;
  readonly formName: string;
  readonly createdAt: string;
  readonly completed: boolean;
}

type ConsumerInboxFilter = "all" | "unread" | "pending" | "completed";

function ConsumerInboxPanel({
  messages,
  onOpenDocument,
  onRead,
  onRefresh,
  readMessageIds,
}: {
  readonly messages: readonly ConsumerInboxMessage[];
  readonly onOpenDocument: (id: string) => void;
  readonly onRead: (id: string) => void;
  readonly onRefresh: () => Promise<void>;
  readonly readMessageIds: ReadonlySet<string>;
}) {
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ConsumerInboxFilter>("all");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const unreadCount = messages.filter(
    (message) => !readMessageIds.has(message.id),
  ).length;

  const visibleMessages = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pl-PL");
    return messages.filter((message) => {
      if (filter === "unread" && readMessageIds.has(message.id)) return false;
      if (filter === "pending" && message.completed) return false;
      if (filter === "completed" && !message.completed) return false;
      if (!normalizedQuery) return true;
      return [message.title, message.body, message.salonName, message.formName].some(
        (value) => value.toLocaleLowerCase("pl-PL").includes(normalizedQuery),
      );
    });
  }, [filter, messages, query, readMessageIds]);
  const selectedMessage =
    visibleMessages.find((message) => message.id === selectedId) ??
    visibleMessages[0] ??
    null;

  const selectMessage = (message: ConsumerInboxMessage) => {
    setSelectedId(message.id);
    onRead(message.id);
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const folders: readonly {
    readonly id: ConsumerInboxFilter;
    readonly label: string;
    readonly icon: LucideIcon;
    readonly count?: number;
  }[] = [
    { id: "all", label: t("Odebrane"), icon: Inbox, count: messages.length },
    { id: "unread", label: t("Nieprzeczytane"), icon: Mail, count: unreadCount },
    {
      id: "pending",
      label: t("Oczekujące"),
      icon: Clock3,
      count: messages.filter((message) => !message.completed).length,
    },
    {
      id: "completed",
      label: t("Zakończone"),
      icon: CheckCircle2,
      count: messages.filter((message) => message.completed).length,
    },
  ];

  return (
    <section aria-labelledby="consumer-inbox-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#245c4d]">
            {t("Centrum powiadomień")}
          </p>
          <h2
            className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#173d35]"
            id="consumer-inbox-heading"
          >
            {t("Skrzynka")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            {t("Informacje o podpisach salonu i zmianach statusu Twoich formularzy.")}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e3ead9] px-3.5 py-2 text-xs font-black text-[#245c4d]">
          <Mail className="size-3.5" /> {unreadCount}{" "}{t("nieprzeczytanych")}
        </span>
      </div>

      <div className="mt-6 overflow-hidden rounded-[28px] border border-[#e3e8dc] bg-white shadow-sm lg:grid lg:min-h-[650px] lg:grid-cols-[210px_minmax(300px,0.85fr)_minmax(380px,1.15fr)]">
        <aside className="border-b border-[#eaeee4] bg-[#f9fbf6] p-4 lg:border-b-0 lg:border-r">
          <button
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#245c4d] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#467c6e] disabled:opacity-60"
            disabled={refreshing}
            onClick={() => void refresh()}
            type="button"
          >
            {refreshing ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {t("Odśwież")}
          </button>
          <nav aria-label={t("Foldery skrzynki")} className="flex gap-2 overflow-x-auto lg:block lg:space-y-1">
            {folders.map((folder) => {
              const Icon = folder.icon;
              return (
                <button
                  aria-current={filter === folder.id ? "page" : undefined}
                  className={`flex min-w-fit items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-black transition lg:w-full ${
                    filter === folder.id
                      ? "bg-[#e9f0df] text-[#447569]"
                      : "text-stone-500 hover:bg-white hover:text-[#447569]"
                  }`}
                  key={folder.id}
                  onClick={() => setFilter(folder.id)}
                  type="button"
                >
                  <Icon className="size-4" />
                  <span className="flex-1">{t(folder.label)}</span>
                  {folder.count ? (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-[#245c4d]">
                      {folder.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="border-b border-[#eaeee4] lg:border-b-0 lg:border-r">
          <div className="border-b border-[#eaeee4] p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <span className="sr-only">{t("Szukaj w skrzynce")}</span>
              <input
                className="w-full rounded-2xl border border-[#e1e6da] bg-[#f9fbf7] py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#87b9ac] focus:bg-white focus:ring-2 focus:ring-[#e2ead6]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("Szukaj salonu lub formularza")}
                type="search"
                value={query}
              />
            </label>
          </div>
          <div className="max-h-[520px] overflow-y-auto lg:max-h-[590px]">
            {visibleMessages.length ? (
              visibleMessages.map((message) => {
              const unread = !readMessageIds.has(message.id);
              return (
                <button
                  className={`flex w-full gap-3 border-b border-[#edf0e8] px-4 py-4 text-left transition last:border-b-0 ${
                    selectedMessage?.id === message.id
                      ? "bg-[#f3f8ec]"
                      : unread
                        ? "bg-white hover:bg-[#fafcf8]"
                        : "bg-[#fcfaf8] hover:bg-[#f8faf5]"
                  }`}
                  key={message.id}
                  onClick={() => selectMessage(message)}
                  type="button"
                >
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                      message.completed
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {message.completed ? (
                      <CheckCircle2 className="size-4.5" />
                    ) : (
                      <Clock3 className="size-4.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className={`truncate text-sm text-[#173d35] ${unread ? "font-black" : "font-bold"}`}>
                        {t(message.title)}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold text-stone-400">
                        {formatShortDate(message.createdAt)}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs font-bold text-[#537658]">
                      {message.formName}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-stone-500">
                      {t(message.body)}
                    </span>
                  </span>
                  {unread ? (
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-[#245c4d]" />
                  ) : null}
                </button>
              );
              })
            ) : (
              <ConsumerInboxEmpty />
            )}
          </div>
        </div>

        <div className="min-h-[360px] bg-white">
          {selectedMessage ? (
            <article className="flex h-full flex-col p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3 border-b border-[#eaeee4] pb-4">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black ${selectedMessage.completed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                  {selectedMessage.completed ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <Clock3 className="size-3.5" />
                  )}
                  {selectedMessage.completed
                    ? t("Dokument kompletny")
                    : t("Oczekuje na salon")}
                </span>
                {readMessageIds.has(selectedMessage.id) ? (
                  <MailOpen className="size-4 text-stone-400" />
                ) : (
                  <Mail className="size-4 text-[#245c4d]" />
                )}
              </div>
              <div className="pt-6">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7e9a82]">
                  {formatDate(selectedMessage.createdAt)}
                </p>
                <h3 className="mt-3 text-2xl font-black tracking-[-0.035em] text-[#173d35]">
                  {t(selectedMessage.title)}
                </h3>
                <p className="mt-4 text-sm leading-7 text-stone-600">
                  {t(selectedMessage.body)}
                </p>
                <dl className="mt-6 divide-y divide-[#eaeee5] rounded-2xl border border-[#e5eadd] bg-[#fcfdfa] px-4">
                  <div className="grid gap-1 py-3.5 sm:grid-cols-[120px_1fr]">
                    <dt className="text-[11px] font-black uppercase tracking-[0.08em] text-stone-400">{t("Salon")}</dt>
                    <dd className="text-sm font-bold text-[#344937]">{selectedMessage.salonName}</dd>
                  </div>
                  <div className="grid gap-1 py-3.5 sm:grid-cols-[120px_1fr]">
                    <dt className="text-[11px] font-black uppercase tracking-[0.08em] text-stone-400">{t("Formularz")}</dt>
                    <dd className="text-sm font-bold text-[#344937]">{selectedMessage.formName}</dd>
                  </div>
                </dl>
                <button
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#245c4d] px-5 py-3 text-sm font-black text-white transition hover:bg-[#467c6e]"
                  onClick={() => {
                    onRead(selectedMessage.id);
                    onOpenDocument(selectedMessage.submissionId);
                  }}
                  type="button"
                >
                  <FileText className="size-4" />{" "}{t("Zobacz formularz")}
                </button>
              </div>
            </article>
          ) : (
            <ConsumerInboxEmpty detail />
          )}
        </div>
      </div>
    </section>
  );
}

function ConsumerInboxEmpty({ detail = false }: { readonly detail?: boolean }) {
  const t = useT();
  return (
    <div className="grid min-h-[360px] place-items-center px-6 py-14 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eef3e8] text-[#245c4d]">
          {detail ? <MailOpen className="size-5" /> : <Inbox className="size-5" />}
        </span>
        <p className="mt-4 text-sm font-black text-[#344937]">
          {detail ? t("Wybierz wiadomość") : t("Skrzynka jest pusta")}
        </p>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          {t("Powiadomienia o formularzach pojawią się tutaj automatycznie.")}
        </p>
      </div>
    </div>
  );
}

function buildConsumerInboxMessages(
  documents: readonly BeautyDocsConsumerDocument[],
): ConsumerInboxMessage[] {
  return documents
    .map((document) => {
      const completed = document.status === "SIGNED";
      return {
        id: `${document.submissionId}:${document.status}`,
        submissionId: document.submissionId,
        title: completed
          ? "Salon podpisał formularz"
          : "Formularz przekazany do salonu",
        body: completed
          ? `Dokument „${document.formName}” został podpisany przez osobę wykonującą zabieg i jest kompletny.`
          : `Twój podpis został zapisany. Dokument „${document.formName}” oczekuje teraz na podpis osoby wykonującej zabieg.`,
        salonName: document.salonName,
        formName: document.formName,
        createdAt:
          (completed ? document.practitionerSignedAt : null) ??
          document.signedAt ??
          document.sharedAt,
        completed,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
}

/** Stable, non-reversible fingerprint for a consumer profile, used to namespace localStorage keys. */
function hashConsumerIdentity(profile: BeautyDocsConsumerProfile): string {
  const identity = `${profile.phone ?? ""}|${profile.email ?? ""}|${profile.fullName}`;
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildConsumerInboxStorageKey(profile: BeautyDocsConsumerProfile): string {
  return `beautydocs:consumer-inbox-read:${hashConsumerIdentity(profile)}`;
}

function buildConsumerOnboardingStorageKey(profile: BeautyDocsConsumerProfile): string {
  return `beautydocs:consumer-onboarding-seen:${hashConsumerIdentity(profile)}`;
}

/** The setup wizard should offer itself once; after that it's opened only from "Uzupełnij profil". */
function hasSeenConsumerOnboarding(storageKey: string): boolean {
  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

function markConsumerOnboardingSeen(storageKey: string): void {
  try {
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // Best-effort only; worst case the wizard offers itself again next visit.
  }
}

function readConsumerInboxMessageIds(storageKey: string): Set<string> {
  try {
    const stored = window.localStorage.getItem(storageKey);
    const parsed = stored ? (JSON.parse(stored) as unknown) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

function consumerDocumentStatusLabel(status: string): string {
  return status === "SIGNED"
    ? "Kompletny — podpisany przez salon"
    : "Oczekuje na podpis salonu";
}

function ConsumerSetupDialog({ catalog, onClose, onProfileChange, profile }: { readonly catalog: BeautyDocsConsumerMedicalCatalog; readonly onClose: () => void; readonly onProfileChange: (state: BeautyDocsConsumerState) => void; readonly profile: BeautyDocsConsumerProfile }) {
  const t = useT();
  const [step, setStep] = useState(0);
  const steps = [t("Start"), t("Dane"), t("Wywiad"), t("Podpis"), t("Gotowe")];

  // Lock background scroll while the wizard is open — without this the page
  // behind the dialog stays scrollable and keeps its scrollbar visible.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-[70] grid place-items-center bg-[#182119]/65 p-3 backdrop-blur-md sm:p-6" exit={{ opacity: 0 }} initial={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={t("Konfiguracja profilu klientki")}>
      <motion.div animate={{ opacity: 1, scale: 1, y: 0 }} className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-[32px] bg-[#f5f8f2] shadow-2xl" exit={{ opacity: 0, scale: 0.97, y: 14 }} initial={{ opacity: 0, scale: 0.96, y: 24 }} transition={{ duration: 0.28 }}>
        <div className="sticky top-0 z-20 border-b border-[#e2e7db] bg-[#fdfffb]/95 px-5 py-3 backdrop-blur sm:px-7"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-2xl bg-[#e3ead9] text-[#245c4d]"><Sparkles className="size-4" /></span><div><h2 className="font-black">{t("Konfiguracja profilu")}</h2><p className="text-xs text-stone-500">{t("Krok")}{" "}{Math.min(step + 1, steps.length)}{" "}{t("z")}{" "}{steps.length}</p></div></div><button aria-label={t("Zamknij konfigurację")} className="rounded-full border border-stone-200 bg-white p-2" onClick={onClose} type="button"><X className="size-5" /></button></div><div className="mt-3 grid grid-cols-5 gap-2">{steps.map((label, index) => <div key={label}><div className={`h-1.5 rounded-full transition ${index <= step ? "bg-[#245c4d]" : "bg-[#e5eadf]"}`} /><span className="mt-1 hidden text-[9px] font-bold uppercase tracking-wide text-stone-400 sm:block">{t(label)}</span></div>)}</div></div>
        <div className="p-4 sm:p-6"><AnimatePresence mode="wait"><motion.div animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} initial={{ opacity: 0, x: 18 }} key={step} transition={{ duration: 0.22 }}>
          {step === 0 ? <div className="mx-auto max-w-2xl px-3 py-4 text-center sm:py-8"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e3ead9] text-[#245c4d]"><Sparkles className="size-6" /></span><p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-[#599687]">{t("Twój profil BeautyDocs")}</p><h3 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">{t("Mniej wpisywania.")}<br />{t("Więcej spokoju przed wizytą.")}</h3><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-600">{t("Uzupełnimy dane osobowe, pełny wywiad medyczny i Twój podpis. Każdy formularz nadal zobaczysz i zatwierdzisz samodzielnie.")}</p><button className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#245c4d] px-7 py-3 text-sm font-black text-white shadow-xl" onClick={() => setStep(1)} type="button">{t("Zaczynamy")}{" "}<ChevronRight className="size-4" /></button><button className="mt-3 block w-full text-sm font-bold text-stone-400" onClick={onClose} type="button">{t("Dokończę później")}</button></div> : null}
          {step === 1 ? <div><PersonalDataPanel onProfileChange={onProfileChange} profile={profile} /><ConsumerSetupWizardNav onBack={() => setStep((current) => Math.max(0, current - 1))} onNext={() => setStep(2)} /></div> : null}
          {step === 2 ? <div><MedicalInterviewPanel catalog={catalog} onProfileChange={onProfileChange} onSaved={() => setStep(3)} profile={profile} /><ConsumerSetupWizardNav onBack={() => setStep((current) => Math.max(0, current - 1))} onNext={() => setStep(3)} /></div> : null}
          {step === 3 ? <div><ConsumerSignaturePanel onProfileChange={onProfileChange} onSaved={() => setStep(4)} profile={profile} /><ConsumerSetupWizardNav onBack={() => setStep((current) => Math.max(0, current - 1))} onNext={() => setStep(4)} /></div> : null}
          {step === 4 ? <div className="mx-auto max-w-2xl px-3 py-6 text-center sm:py-10"><motion.span animate={{ scale: 1 }} className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700" initial={{ scale: 0.65 }}><Check className="size-7" /></motion.span><h3 className="mt-5 text-2xl font-black tracking-tight sm:text-3xl">{t("Profil jest gotowy do użycia")}</h3><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-stone-600">{t("Możesz wracać do każdej sekcji i aktualizować informacje, kiedy tylko coś się zmieni.")}</p><button className="mt-6 rounded-2xl bg-[#245c4d] px-7 py-3 text-sm font-black text-white" onClick={onClose} type="button">{t("Przejdź do panelu")}</button></div> : null}
        </motion.div></AnimatePresence></div>
      </motion.div>
    </motion.div>
  );
}

function ConsumerSetupWizardNav({
  onBack,
  onNext,
}: {
  readonly onBack: () => void;
  readonly onNext: () => void;
}) {
  const t = useT();
  return (
    <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#e2e7db] pt-5">
      <button
        className="inline-flex items-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-black text-stone-600 transition hover:bg-stone-50"
        onClick={onBack}
        type="button"
      >
        <ArrowLeft className="size-4" />{" "}{t("Wstecz")}
      </button>
      <button
        className="inline-flex items-center gap-1.5 rounded-2xl bg-[#245c4d] px-6 py-3 text-sm font-black text-white transition hover:bg-[#477d6f]"
        onClick={onNext}
        type="button"
      >
        {t("Dalej")}{" "}<ChevronRight className="size-4" />
      </button>
    </div>
  );
}

function mfaEnrollmentErrorMessage(status: number, method: "SMS" | "TOTP"): string {
  if (status === 401) return "Sesja wygasła. Zaloguj się ponownie.";
  if (status === 402) {
    return "Nie udało się wysłać SMS — spróbuj ponownie później lub użyj aplikacji uwierzytelniającej.";
  }
  if (status === 409) return "2FA jest już aktywne. Najpierw wybierz zmianę obecnej metody.";
  if (status === 422) {
    return method === "SMS"
      ? "Podaj prawidłowy numer telefonu."
      : "Nie udało się przygotować konfiguracji aplikacji uwierzytelniającej.";
  }
  if (status === 429) return "Zbyt wiele prób. Spróbuj ponownie za chwilę.";
  return "Nie udało się rozpocząć konfiguracji 2FA.";
}

/**
 * Client-side counterpart of the owner panel's MfaSettings: same SMS /
 * authenticator-app enrollment, change and disable flow, pointed at the
 * consumer MFA endpoints instead of the owner ones. Self-contained (fetches
 * its own state) since, unlike the owner panel, this settings screen has no
 * server-rendered initial MFA prop to receive.
 */
function ConsumerMfaSettings() {
  const t = useT();
  const [mfa, setMfa] = useState<BeautyDocsMfaState | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<BeautyDocsMfaChallenge | null>(null);
  const [mfaPhone, setMfaPhone] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaChangeChallengeId, setMfaChangeChallengeId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/beautydocs-preview/consumer/mfa", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!cancelled && response.ok) {
        setMfa((await response.json()) as BeautyDocsMfaState);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startEnrollment = async (method: "SMS" | "TOTP") => {
    if (method === "SMS" && mfaPhone.replace(/\D/g, "").length < 8) {
      setError(t("Podaj prawidłowy numer telefonu."));
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/beautydocs-preview/consumer/mfa/enrollment", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method,
          ...(method === "SMS" ? { phone: mfaPhone } : {}),
          ...(mfaChangeChallengeId ? { changeChallengeId: mfaChangeChallengeId } : {}),
        }),
      });
      if (!response.ok) {
        setError(mfaEnrollmentErrorMessage(response.status, method));
        return;
      }
      setMfaChallenge((await response.json()) as BeautyDocsMfaChallenge);
      setMfaCode("");
    } catch {
      setError(t("Nie udało się połączyć z usługą 2FA. Spróbuj ponownie."));
    } finally {
      setPending(false);
    }
  };

  const confirmEnrollment = async () => {
    if (!mfaChallenge || !/^\d{6}$/.test(mfaCode)) {
      setError(t("Wpisz pełny 6-cyfrowy kod."));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/beautydocs-preview/consumer/mfa/enrollment/confirm",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ challengeId: mfaChallenge.challengeId, code: mfaCode }),
        },
      );
      if (!response.ok) {
        setError(
          response.status === 400
            ? t("Kod jest nieprawidłowy lub wygasł.")
            : t("Nie udało się włączyć 2FA."),
        );
        return;
      }
      const changedExistingMethod = mfaChangeChallengeId !== null;
      setMfa((await response.json()) as BeautyDocsMfaState);
      setMfaChallenge(null);
      setMfaChangeChallengeId(null);
      setMfaCode("");
      setMfaPhone("");
      setMessage(
        changedExistingMethod
          ? t("Metoda weryfikacji 2FA została zmieniona.")
          : t("Dodatkowe zabezpieczenie 2FA zostało włączone."),
      );
    } catch {
      setError(t("Nie udało się potwierdzić konfiguracji 2FA."));
    } finally {
      setPending(false);
    }
  };

  const startDisable = async () => {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/beautydocs-preview/consumer/mfa/disable-challenge", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("mfa-disable-failed");
      setMfaChallenge((await response.json()) as BeautyDocsMfaChallenge);
      setMfaCode("");
    } catch {
      setError(t("Nie udało się rozpocząć wyłączania 2FA."));
    } finally {
      setPending(false);
    }
  };

  const startChange = async () => {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/beautydocs-preview/consumer/mfa/change-challenge", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("mfa-change-failed");
      setMfaChallenge((await response.json()) as BeautyDocsMfaChallenge);
      setMfaCode("");
    } catch {
      setError(t("Nie udało się rozpocząć zmiany 2FA."));
    } finally {
      setPending(false);
    }
  };

  const confirmChange = async () => {
    if (!mfaChallenge || !/^\d{6}$/.test(mfaCode)) {
      setError(t("Wpisz pełny 6-cyfrowy kod."));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/beautydocs-preview/consumer/mfa/change/confirm", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId: mfaChallenge.challengeId, code: mfaCode }),
      });
      if (!response.ok) {
        setError(
          response.status === 400
            ? t("Kod jest nieprawidłowy lub wygasł.")
            : t("Nie udało się potwierdzić zmiany 2FA."),
        );
        return;
      }
      const result = (await response.json()) as { changeChallengeId: string };
      setMfaChangeChallengeId(result.changeChallengeId);
      setMfaChallenge(null);
      setMfaCode("");
      setMfaPhone("");
      setMessage(t("Tożsamość potwierdzona. Wybierz nową metodę 2FA."));
    } catch {
      setError(t("Nie udało się potwierdzić zmiany 2FA."));
    } finally {
      setPending(false);
    }
  };

  const confirmDisable = async () => {
    if (!mfaChallenge || !/^\d{6}$/.test(mfaCode)) {
      setError(t("Wpisz pełny 6-cyfrowy kod."));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/beautydocs-preview/consumer/mfa/disable/confirm", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId: mfaChallenge.challengeId, code: mfaCode }),
      });
      if (!response.ok) {
        setError(
          response.status === 400
            ? t("Kod jest nieprawidłowy lub wygasł.")
            : t("Nie udało się wyłączyć 2FA."),
        );
        return;
      }
      setMfa({ enabled: false, method: null, destinationMasked: null, enabledAt: null });
      setMfaChallenge(null);
      setMfaCode("");
      setMessage(t("Dodatkowe zabezpieczenie 2FA zostało wyłączone."));
    } catch {
      setError(t("Nie udało się wyłączyć 2FA."));
    } finally {
      setPending(false);
    }
  };

  const cancelMfaFlow = () => {
    setMfaChallenge(null);
    setMfaChangeChallengeId(null);
    setMfaCode("");
    setMfaPhone("");
    setError(null);
  };

  return (
    <section className="rounded-[30px] border border-[#e3e8dd] bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef3e7] text-[#245c4d]">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-black">{t("Weryfikacja dwuetapowa (2FA)")}</h2>
          <p className="mt-1 text-sm text-stone-500">
            {t("Dodatkowe zabezpieczenie logowania kodem SMS lub aplikacją uwierzytelniającą.")}
          </p>
        </div>
      </div>

      {message ? (
        <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {t(message)}
        </p>
      ) : null}
      {error ? (
        <p
          className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {mfa === null ? (
        <div className="mt-6 flex items-center justify-center rounded-3xl border border-[#e3e8dd] bg-[#f7f8f4] p-8">
          <LoaderCircle className="size-5 animate-spin text-[#245c4d]" />
        </div>
      ) : mfaChallenge ? (
        <MfaChallengeCard
          challenge={mfaChallenge}
          code={mfaCode}
          onCancel={cancelMfaFlow}
          onCodeChange={setMfaCode}
          onConfirmChange={() => void confirmChange()}
          onConfirmDisable={() => void confirmDisable()}
          onConfirmEnrollment={() => void confirmEnrollment()}
          pending={pending}
        />
      ) : mfa.enabled && mfaChangeChallengeId === null ? (
        <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <h3 className="font-black text-emerald-950">{t("2FA jest włączone")}</h3>
                <p className="mt-1 text-sm leading-6 text-emerald-900/70">
                  {mfa.method === "SMS"
                    ? t("Kody logowania będą wysyłane na {value1}.", { value1: mfa.destinationMasked ?? "zweryfikowany numer" })
                    : t("Przy logowaniu podasz kod z aplikacji uwierzytelniającej.")}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-emerald-700">
              {mfa.method === "SMS" ? t("Kod SMS") : t("Aplikacja TOTP")}
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-50"
              disabled={pending}
              onClick={() => void startChange()}
              type="button"
            >
              {t("Zmień metodę lub numer")}
            </button>
            <button
              className="rounded-2xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-black text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
              disabled={pending}
              onClick={() => void startDisable()}
              type="button"
            >
              {t("Wyłącz 2FA")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {mfaChangeChallengeId ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 lg:col-span-2">
              {t("Obecne zabezpieczenie nadal działa. Zostanie zastąpione dopiero po potwierdzeniu nowego numeru lub nowej aplikacji.")}
            </div>
          ) : null}
          <div className="rounded-3xl border border-[#e3e8dd] bg-[#f7f8f4] p-5">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#eef3e7] text-[#245c4d]">
              <Smartphone className="size-5" />
            </span>
            <h3 className="mt-4 font-black">{t("Kod SMS")}</h3>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              {t("Po podaniu hasła otrzymasz jednorazowy kod na wybrany numer telefonu.")}
            </p>
            <div className="mt-4">
              <BeautyDocsPhoneNumberField
                disabled={pending}
                id="consumer-mfa-phone"
                onChange={setMfaPhone}
                value={mfaPhone}
              />
            </div>
            <button
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#245c4d] px-4 py-3.5 font-black text-white shadow-[0_12px_30px_rgba(36,92,77,0.18)] transition hover:bg-[#173d35] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={pending || mfaPhone.replace(/\D/g, "").length < 8}
              onClick={() => void startEnrollment("SMS")}
              type="button"
            >
              {mfaChangeChallengeId ? t("Ustaw nowy numer SMS") : t("Skonfiguruj SMS")}
            </button>
          </div>

          <div className="rounded-3xl border border-[#e3e8dd] bg-[#f7f8f4] p-5">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#eef3e7] text-[#245c4d]">
              <KeyRound className="size-5" />
            </span>
            <h3 className="mt-4 font-black">{t("Aplikacja uwierzytelniająca")}</h3>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              {t("Działa z Google Authenticator, Microsoft Authenticator i innymi aplikacjami obsługującymi TOTP.")}
            </p>
            <button
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#245c4d] px-4 py-3.5 font-black text-white shadow-[0_12px_30px_rgba(36,92,77,0.18)] transition hover:bg-[#173d35] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={pending}
              onClick={() => void startEnrollment("TOTP")}
              type="button"
            >
              {mfaChangeChallengeId ? t("Przejdź na aplikację") : t("Skonfiguruj aplikację")}
            </button>
          </div>
          {mfaChangeChallengeId ? (
            <button
              className="justify-self-start rounded-2xl border border-[#d4decc] px-5 py-3 text-sm font-black text-stone-600 lg:col-span-2"
              disabled={pending}
              onClick={cancelMfaFlow}
              type="button"
            >
              {t("Anuluj zmianę")}
            </button>
          ) : null}
          <p className="text-xs leading-5 text-stone-500 lg:col-span-2">
            {t("To zabezpieczenie jest dobrowolne. Jeśli go nie włączysz, sposób logowania pozostanie bez zmian.")}
          </p>
        </div>
      )}
    </section>
  );
}

function MfaChallengeCard({
  challenge,
  code,
  onCancel,
  onCodeChange,
  onConfirmChange,
  onConfirmDisable,
  onConfirmEnrollment,
  pending,
}: {
  readonly challenge: BeautyDocsMfaChallenge;
  readonly code: string;
  readonly onCancel: () => void;
  readonly onCodeChange: (value: string) => void;
  readonly onConfirmChange: () => void;
  readonly onConfirmDisable: () => void;
  readonly onConfirmEnrollment: () => void;
  readonly pending: boolean;
}) {
  const t = useT();
  const disabling = challenge.purpose === "DISABLE";
  const changing = challenge.purpose === "CHANGE";
  return (
    <div className="mt-6 rounded-3xl border border-[#e3e8dd] bg-[#f7f8f4] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#eef3e7] text-[#245c4d]">
          {challenge.method === "SMS" ? (
            <Smartphone className="size-5" />
          ) : (
            <KeyRound className="size-5" />
          )}
        </span>
        <div>
          <h3 className="font-black text-[#173d35]">
            {disabling
              ? t("Potwierdź wyłączenie 2FA")
              : changing
                ? t("Potwierdź zmianę zabezpieczenia")
                : challenge.method === "SMS"
                  ? t("Potwierdź numer telefonu")
                  : t("Połącz aplikację uwierzytelniającą")}
          </h3>
          <p className="mt-1 text-sm leading-6 text-stone-500">
            {challenge.method === "SMS"
              ? t("Wpisz kod wysłany na {value1}.", { value1: challenge.destinationMasked ?? t("Twój telefon") })
              : disabling || changing
                ? t("Wpisz aktualny kod z aplikacji uwierzytelniającej.")
                : t("Zeskanuj kod QR w Google Authenticator, Microsoft Authenticator lub innej aplikacji TOTP, a następnie wpisz wygenerowany kod.")}
          </p>
        </div>
      </div>

      {!disabling && challenge.method === "TOTP" && challenge.qrCodeDataUrl ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-[190px_1fr] sm:items-center">
          <div className="rounded-2xl border border-[#e3e8dd] bg-white p-3">
            <Image
              alt={t("Kod QR do połączenia aplikacji uwierzytelniającej")}
              className="h-auto w-full"
              height={180}
              src={challenge.qrCodeDataUrl}
              unoptimized
              width={180}
            />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-stone-500">
              {t("Klucz do ręcznego wpisania")}
            </p>
            <code className="mt-2 block break-all rounded-xl bg-white px-3 py-3 text-sm font-black tracking-[0.12em] text-[#173d35]">
              {challenge.secret}
            </code>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              {t("Klucz jest widoczny tylko podczas tej konfiguracji. Nie udostępniaj go innym osobom.")}
            </p>
          </div>
        </div>
      ) : null}

      {challenge.devCode ? (
        <p className="mt-5 rounded-xl bg-[#eef3e7] px-3 py-2 text-center text-xs font-bold text-[#245c4d]">
          {t("Tryb testowy — kod:")}{" "}<span className="font-black tracking-widest">{challenge.devCode}</span>
        </p>
      ) : null}

      <label className="mt-5 block max-w-sm text-xs font-black uppercase tracking-[0.12em] text-stone-500">
        {t("Kod 6-cyfrowy")}
        <input
          autoComplete="one-time-code"
          className={`${inputClass} mt-2 text-center text-lg tracking-[0.35em]`}
          disabled={pending}
          inputMode="numeric"
          maxLength={6}
          onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          value={code}
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="rounded-2xl bg-[#245c4d] px-5 py-3 text-sm font-black text-white transition hover:bg-[#173d35] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending || code.length !== 6}
          onClick={disabling ? onConfirmDisable : changing ? onConfirmChange : onConfirmEnrollment}
          type="button"
        >
          {disabling ? t("Wyłącz 2FA") : changing ? t("Potwierdź i wybierz nową metodę") : t("Potwierdź i włącz 2FA")}
        </button>
        <button
          className="rounded-2xl border border-[#d4decc] px-5 py-3 text-sm font-black text-stone-600"
          disabled={pending}
          onClick={onCancel}
          type="button"
        >
          {t("Anuluj")}
        </button>
      </div>
    </div>
  );
}

function ConsumerAccountSettings() {
  const t = useT();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const removeAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    const response = await fetch("/api/beautydocs-preview/consumer/account", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation: "USUŃ KONTO" }),
    });
    if (response.ok) {
      window.location.assign("/");
      return;
    }
    setDeleting(false);
    setDeleteError(t("Nie udało się usunąć konta. Spróbuj ponownie."));
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#245c4d]">
          {t("Twoje konto")}
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#173d35]">
          {t("Ustawienia")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-500">
          {t("Bezpieczeństwo logowania i zarządzanie Twoim kontem.")}
        </p>
      </div>
      <section className="rounded-[30px] border border-[#e3e8dd] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef3e8] text-[#245c4d]">
            <Languages className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-black">{t("Język aplikacji")}</h2>
            <p className="mt-1 text-sm text-stone-500">
              {t("Wybierz język menu, formularzy i dokumentów. Zmiana dotyczy tylko Twojego konta.")}
            </p>
          </div>
        </div>
        <BeautyDocsLanguageList account="consumer" className="mt-6 max-w-xl" />
      </section>
      <ConsumerMfaSettings />
      <section className="rounded-[30px] border border-[#e3e8dd] bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
          <Settings className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-black">{t("Zarządzanie kontem")}</h2>
          <p className="mt-1 text-sm text-stone-500">
            {t("Zarządzaj dostępem do swojego profilu klientki.")}
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-red-50 p-5">
        <div>
          <p className="font-black text-red-950">{t("Chcesz usunąć konto?")}</p>
          <p className="mt-1 text-sm leading-6 text-red-900/75">
            {t("Usunięcie konta jest nieodwracalne i wymaga potwierdzenia kilku informacji.")}
          </p>
        </div>
        <button
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-red-300 bg-white px-5 py-2.5 text-sm font-black text-red-800 transition hover:bg-red-100"
          onClick={() => setDeleteDialogOpen(true)}
          type="button"
        >
          <Trash2 className="size-4" />{" "}{t("Usuń konto")}
        </button>
      </div>
      <BeautyDocsDeleteAccountDialog
        consequences={[
          t("Rozumiem, że moje konto logowania, zapisany profil i wywiad medyczny zostaną usunięte."),
          t("Rozumiem, że oryginały podpisanych formularzy pozostają pod kontrolą salonów i mogą być przechowywane, gdy wymaga tego prawo lub obrona roszczeń."),
          t("Rozumiem, że tej operacji nie można cofnąć."),
        ]}
        error={deleteError}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => void removeAccount()}
        open={deleteDialogOpen}
        pending={deleting}
        title={t("Czy na pewno chcesz usunąć konto klientki?")}
      />
      </section>
    </div>
  );
}

const DOCUMENT_CONSENT_SIGNATURE_KEYS: Readonly<Record<string, string>> = {
  zgodaWykonanieZabiegu: "podpisDane",
  zgodaPrzetwarzanieDanych: "podpisRodo",
  zgodaMarketing: "podpisMarketing",
  zgodaFotografie: "podpisFotografie",
};

function DocumentDialog({
  detail,
  onClose,
}: {
  readonly detail: BeautyDocsConsumerDocumentDetail;
  readonly onClose: () => void;
}) {
  const t = useT();
  const practitionerSignedAt =
    detail.practitionerSignedAt ??
    (typeof detail.practitioner?.signedAt === "string"
      ? detail.practitioner.signedAt
      : null);
  const practitionerDisplayName =
    typeof detail.practitioner?.displayName === "string"
      ? detail.practitioner.displayName
      : null;
  const documentAnswers = detail.sections.flatMap((section) => section.items);
  const treatmentArea = documentAnswers.find(
    (answer) => answer.kind === "treatment_area",
  );
  const treatmentAreaLabels = getTreatmentAreaLabels(
    detail.anatomy,
    detail.treatmentAreaIds,
  );
  const treatmentAreaDisplayValue =
    treatmentAreaLabels.join(", ") ||
    treatmentArea?.value?.trim() ||
    t("Nie wskazano obszaru");
  const consents = documentAnswers.filter(
    (answer) => answer.kind === "consent",
  );
  const acceptedConsents = consents.filter((answer) =>
    isAcceptedDocumentValue(answer.value),
  ).length;
  const signatures = documentAnswers.filter(
    (answer) => answer.kind === "signature",
  );
  const completedSignatures = signatures.filter((answer) =>
    isAcceptedDocumentValue(answer.value),
  ).length;
  const consentKeys = new Set(consents.map((answer) => answer.key));
  const linkedSignatureKeys = new Set(
    [...consentKeys]
      .map((key) => DOCUMENT_CONSENT_SIGNATURE_KEYS[key])
      .filter((key): key is string => Boolean(key)),
  );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#173d35]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-40 flex items-start justify-between gap-4 border-b border-[#e5eadf] bg-white px-6 py-5 shadow-[0_8px_20px_rgba(23,61,53,0.06)] sm:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#245c4d]">{detail.salonName}</p>
            <h2 className="mt-1 text-2xl font-black">{detail.formName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-sm text-stone-500">{formatDate(detail.signedAt ?? detail.sharedAt)}</p>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${detail.status === "SIGNED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                {t(consumerDocumentStatusLabel(detail.status))}
              </span>
            </div>
          </div>
          <button className="rounded-full border border-stone-200 p-2" onClick={onClose} type="button" aria-label={t("Zamknij")}>
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-6 px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-500">{t("Zapisz kopię formularza lub wydrukuj ją na A4.")}</p>
            <BeautyDocsPdfDownload eligible={canDownloadFormPdf(detail.status, detail.clientSignedAt, detail.practitionerSignedAt, detail.signatureKeys)} documentId={detail.submissionId} href={`/api/beautydocs-preview/consumer/documents/${encodeURIComponent(detail.submissionId)}/pdf`} />
          </div>
          <section aria-labelledby="document-highlights-heading">
            <h3 className="font-black" id="document-highlights-heading">
              {t("Najważniejsze informacje")}
            </h3>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              <ConsumerDocumentHighlight
                icon={MapPin}
                label={t("Obszar zabiegu")}
                value={treatmentAreaDisplayValue}
              />
              <ConsumerDocumentHighlight
                icon={ClipboardCheck}
                label={t("Zgody")}
                value={
                  consents.length > 0
                    ? `${acceptedConsents} z ${consents.length} zaakceptowane`
                    : "Brak zapisanych zgód"
                }
              />
              <ConsumerDocumentHighlight
                icon={PenLine}
                label={t("Podpisy klientki")}
                value={
                  signatures.length > 0
                    ? `${completedSignatures} z ${signatures.length} złożone`
                    : "Brak zapisanych podpisów"
                }
              />
            </dl>
          </section>
          {detail.treatmentAreaIds.length > 0 ? (
            <section className="rounded-2xl border border-[#d4decc] bg-[#f7f8f4] p-4 sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245c4d]">
                {t("Wizualizacja obszaru zabiegu")}
              </p>
              <h3 className="mt-1 font-black text-[#173d35]">
                {t("Zaznaczone miejsca")}
              </h3>
              <div className="mt-4">
                <BeautyDocsTreatmentAreaVisualization
                  anatomy={detail.anatomy}
                  selectedIds={detail.treatmentAreaIds}
                />
              </div>
            </section>
          ) : null}
          <div className="rounded-2xl bg-[#f6f8f3] p-5">
            <h3 className="font-black">{t("Potwierdzenie podpisów")}</h3>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {t("Podpis klientki:")}{" "}{detail.clientSignedAt ? formatDate(detail.clientSignedAt) : "zarejestrowany"}{t(". Dokument zawiera")}{" "}{detail.signatureKeys.length}{" "}{t("osobne podpisy.")}
            </p>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              {practitionerSignedAt
                ? t("Osoba wykonująca zabieg podpisała dokument {value1}.", { value1: formatDate(practitionerSignedAt) })
                : t("Podpis klientki jest zapisany. Dokument oczekuje jeszcze na osobny podpis osoby wykonującej zabieg.")}
            </p>
            {practitionerSignedAt && practitionerDisplayName ? (
              <figure className="mt-4 rounded-xl border border-stone-200 bg-white p-3">
                <figcaption className="mb-2 text-xs font-semibold text-stone-500">
                  {t("Podpis osoby wykonującej zabieg —")}{" "}{practitionerDisplayName}
                </figcaption>
                <div className="overflow-hidden rounded-lg border border-stone-200 bg-[#f7f8f4]">
                  <Image
                    alt={t("Podpis wykonawcy — {practitionerDisplayName}", { practitionerDisplayName: practitionerDisplayName })}
                    className="h-auto max-h-40 w-full object-contain"
                    height={220}
                    src={buildConsumerPractitionerSignatureUrl(detail.submissionId)}
                    unoptimized
                    width={640}
                  />
                </div>
              </figure>
            ) : null}
          </div>
          {detail.sections.length > 0 ? (
            detail.sections
              .filter((section) =>
                section.items.some(
                  (answer) =>
                    answer.kind !== "signature" ||
                    !linkedSignatureKeys.has(answer.key),
                ),
              )
              .map((section, sectionIndex) => (
              <section
                className="overflow-hidden rounded-2xl border border-stone-200"
                key={`${section.key}-${sectionIndex}`}
              >
                <header className="border-b border-stone-200 bg-[#f7f8f4] px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245c4d]">
                    {t("Sekcja")}{" "}{sectionIndex + 1}
                  </p>
                  <h3 className="mt-1 font-black">{t(section.title)}</h3>
                </header>
                <dl className="divide-y divide-stone-100">
                  {section.items
                    .filter(
                      (answer) =>
                        answer.kind !== "signature" ||
                        !linkedSignatureKeys.has(answer.key),
                    )
                    .map((answer, answerIndex) => {
                    const signatureKey =
                      answer.kind === "consent"
                        ? DOCUMENT_CONSENT_SIGNATURE_KEYS[answer.key]
                        : answer.kind === "signature"
                          ? answer.key
                          : undefined;
                    return (
                    <ConsumerDocumentAnswer
                      answer={answer}
                      displayValueOverride={
                        answer.kind === "treatment_area"
                          ? treatmentAreaDisplayValue
                          : null
                      }
                      key={`${answer.key}-${answerIndex}`}
                      signatureImageUrl={
                        signatureKey && detail.signatureKeys.includes(signatureKey)
                          ? buildConsumerDocumentSignatureUrl(
                              detail.submissionId,
                              signatureKey,
                            )
                          : null
                      }
                    />
                    );
                  })}
                </dl>
              </section>
              ))
          ) : (
            <p className="rounded-2xl border border-stone-200 px-5 py-6 text-sm text-stone-500">
              {t("Brak zapisanych odpowiedzi.")}
            </p>
          )}
          {detail.status === "SIGNED" ? (
            <BeautyDocsAftercareRecommendations
              tenantSlug={detail.tenantSlug}
              treatmentCode={detail.formCode}
            />
          ) : null}
          <p className="text-xs leading-5 text-stone-500">
            {t("Widok pokazuje kopię pełnego formularza powiązanego z Twoim zweryfikowanym kontem. Salon przechowuje oryginał dokumentacji zabiegowej.")}
          </p>
        </div>
      </div>
    </div>
  );
}

function ConsumerDocumentHighlight({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: string;
}) {
  const t = useT();
  return (
    <div className="rounded-2xl border border-[#d4decc] bg-[#f7f8f4] p-4">
      <dt className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-[#245c4d]">
        <Icon aria-hidden="true" className="size-4" />
        {t(label)}
      </dt>
      <dd className="mt-2 whitespace-pre-wrap break-words text-sm font-black leading-6 text-[#173d35]">
        {value}
      </dd>
    </div>
  );
}

function ConsumerDocumentAnswer({
  answer,
  displayValueOverride,
  signatureImageUrl,
}: {
  readonly answer: BeautyDocsAdminFormAnswer;
  readonly displayValueOverride: string | null;
  readonly signatureImageUrl: string | null;
}) {
  const t = useT();
  const value = answer.value?.trim() ?? "";
  const isAccepted = isAcceptedDocumentValue(value);
  const isBoolean = ["true", "false", "yes", "no", "tak", "nie", "1", "0"].includes(
    value.toLocaleLowerCase("pl-PL"),
  );
  let displayedValue: string;
  if (!value) {
    displayedValue = t("Nie udzielono odpowiedzi");
  } else if (answer.kind === "signature") {
    displayedValue = t("Podpis złożony");
  } else if (answer.kind === "consent") {
    displayedValue = isAccepted ? t("Wyrażono zgodę") : t("Nie wyrażono zgody");
  } else if (answer.kind === "contraindication" && isBoolean) {
    displayedValue = isAccepted ? t("Tak") : t("Nie");
  } else if (value === "true" || value === "false") {
    displayedValue = value === "true" ? t("Tak") : t("Nie");
  } else {
    displayedValue = value;
  }
  if (displayValueOverride) displayedValue = displayValueOverride;

  const detailTitle =
    answer.kind === "consent"
      ? t("Treść udzielonej zgody")
      : answer.kind === "signature"
        ? t("Treść podpisanego dokumentu")
        : answer.kind === "contraindication"
          ? t("Doprecyzowanie odpowiedzi")
          : t("Szczegóły");

  return (
    <div className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] sm:gap-6">
      <dt className="text-sm font-semibold leading-6 text-stone-600">
        {t(answer.label)}
      </dt>
      <dd className="min-w-0">
        <p
          className={`whitespace-pre-wrap break-words text-sm leading-6 ${
            !value
              ? "italic text-stone-400"
              : answer.kind === "consent" || answer.kind === "signature"
                ? "font-black text-[#245c4d]"
                : "font-semibold text-[#173d35]"
          }`}
        >
          {displayedValue}
        </p>
        {signatureImageUrl ? (
          <figure className="mt-3 rounded-xl border border-stone-200 bg-[#f7f8f4] p-3">
            <figcaption className="mb-2 text-xs font-semibold text-stone-500">
              {t("Zapisany podpis")}
            </figcaption>
            <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
              <Image
                alt={t("Podpis — {label}", { label: answer.label })}
                className="h-auto max-h-40 w-full object-contain"
                height={220}
                src={signatureImageUrl}
                unoptimized
                width={640}
              />
            </div>
          </figure>
        ) : null}
        {answer.detail ? (
          <div className="mt-3 rounded-xl border border-[#d4decc] bg-[#fafcf8] px-4 py-3">
            <p className="text-xs font-black text-[#245c4d]">{t(detailTitle)}</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#173d35]">
              {t(answer.detail)}
            </p>
          </div>
        ) : null}
      </dd>
    </div>
  );
}

function isAcceptedDocumentValue(value: string | null): boolean {
  return ["true", "yes", "tak", "1", "accepted", "signed"].includes(
    value?.trim().toLocaleLowerCase("pl-PL") ?? "",
  );
}

function buildConsumerDocumentSignatureUrl(
  submissionId: string,
  signatureKey: string,
): string {
  return (
    `/api/beautydocs-preview/consumer/documents/${encodeURIComponent(submissionId)}` +
    `/signatures/${encodeURIComponent(signatureKey)}`
  );
}

function buildConsumerPractitionerSignatureUrl(submissionId: string): string {
  return (
    `/api/beautydocs-preview/consumer/documents/${encodeURIComponent(submissionId)}` +
    "/practitioner-signature"
  );
}

function sanitizeMedicalAnswers(
  answers: BeautyDocsConsumerProfile["medicalAnswers"],
): Record<string, { answer: "yes" | "no"; followUp: string }> {
  return Object.fromEntries(
    Object.entries(answers).flatMap(([key, value]) =>
      value.answer === "yes" || value.answer === "no"
        ? [[key, { answer: value.answer, followUp: value.followUp ?? "" }]]
        : [],
    ),
  );
}

function isAbsoluteContraindication(
  question: BeautyDocsConsumerMedicalQuestion,
): boolean {
  return (question.category ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pl")
    .includes("BEZWZGLEDNE");
}

function formatContraindicationCount(count: number): string {
  if (count === 1) return "1 bezwzględne przeciwwskazanie";
  if (count >= 2 && count <= 4) return `${count} bezwzględne przeciwwskazania`;
  return `${count} bezwzględnych przeciwwskazań`;
}

function isPersonalDataComplete(profile: BeautyDocsConsumerProfile): boolean {
  return Boolean(
    profile.fullName.trim() &&
      profile.email?.trim() &&
      profile.birthDate &&
      profile.street?.trim() &&
      profile.houseNumber?.trim() &&
      profile.postalCode?.trim() &&
      profile.city?.trim(),
  );
}

function isConsumerProfileComplete(profile: BeautyDocsConsumerProfile): boolean {
  return (
    isPersonalDataComplete(profile) &&
    Object.values(profile.medicalAnswers).some(
      (answer) => answer.answer === "yes" || answer.answer === "no",
    ) &&
    profile.signatureConfigured
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(activeIntlLocale(), { dateStyle: "long", timeStyle: "short" }).format(date);
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(activeIntlLocale(), {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

// Ta sama arytmetyka wieku co w formularzu (BeautyDocsFormFlow). W panelu
// używana wyłącznie jako ostrzeżenie — nie blokuje zapisu profilu.
function checkAdultBirthDate(value: string | null | undefined): string | null {
  const dob = value?.trim() ?? "";
  if (!dob || dob === "--") return null;
  const parts = dob.split("-");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  const [y, m, d] = parts.map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  if (y < 1900 || y > 2026) {
    return "Rok urodzenia wygląda na nieprawidłowy (powinien być w przedziale 1900–2026).";
  }
  const today = new Date();
  const birth = new Date(y, m - 1, d);
  let age = today.getFullYear() - birth.getFullYear();
  const mDiff = today.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  if (age < 18) {
    return "Uwaga: na podstawie tej daty urodzenia nie będziesz mogła podpisać formularzy (wymagane ukończone 18 lat).";
  }
  return null;
}

function ErrorMessage({ message }: { readonly message: string | null }) {
  const t = useT();
  return message ? (
    <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
      {t(message)}
    </p>
  ) : null;
}

function PrimaryButton({
  children,
  pending,
}: {
  readonly children: React.ReactNode;
  readonly pending: boolean;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#245c4d] px-4 py-3.5 font-black text-white shadow-[0_12px_30px_rgba(36,92,77,0.18)] transition-colors hover:bg-[#173d35] disabled:cursor-wait disabled:opacity-70"
      disabled={pending}
      transition={{ type: "spring", bounce: 0, duration: 0.2 }}
      type="submit"
      whileHover={reduceMotion || pending ? undefined : { y: -2 }}
      whileTap={reduceMotion || pending ? undefined : { scale: 0.97 }}
    >
      {pending ? <LoaderCircle className="size-5 animate-spin" /> : children}
    </motion.button>
  );
}
