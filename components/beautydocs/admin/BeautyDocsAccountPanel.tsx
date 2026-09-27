"use client";
import { activeIntlLocale } from "../../../lib/i18n/active";

import { BeautyDocsLanguageList, useT } from "../i18n";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Home,
  KeyRound,
  Languages,
  LogOut,
  Menu,
  PenLine,
  Plus,
  Settings,
  ShieldCheck,
  Smartphone,
  Store,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import type {
  BeautyDocsAdminMembership,
  BeautyDocsMfaChallenge,
  BeautyDocsMfaState,
} from "../../../types/beautydocs-admin";
import { BeautyDocsLogo } from "../BeautyDocsLogo";
import { BeautyDocsDeleteAccountDialog } from "../BeautyDocsDeleteAccountDialog";
import { BeautyDocsCreateSalonDialog } from "./BeautyDocsCreateSalonDialog";
import { BeautyDocsPhoneNumberField } from "../BeautyDocsPhoneNumberField";
import {
  BeautyDocsSidebar,
  BeautyDocsSidebarNav,
  type BeautyDocsSidebarGroup,
} from "../BeautyDocsSidebar";
import { BeautyDocsSignaturePad } from "../forms/BeautyDocsSignaturePad";
import { BeautyDocsLogoutButton } from "./BeautyDocsLogoutButton";
import { roleLabel } from "./BeautyDocsAdminShell";

interface AccountProfile {
  readonly displayName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly emailVerifiedAt: string | null;
  readonly createdAt: string;
  readonly lastLoginAt: string | null;
  readonly signatureConfigured: boolean;
  readonly signatureUpdatedAt: string | null;
}

interface BeautyDocsAccountPanelProps {
  readonly initialMfa: BeautyDocsMfaState;
  readonly initialProfile: AccountProfile;
  readonly memberships: readonly BeautyDocsAdminMembership[];
}

type AccountSection =
  | "home"
  | "profile"
  | "signature"
  | "salons"
  | "settings";
type SettingsTab = "security" | "language" | "account";

const accountNavigation: readonly {
  readonly id: AccountSection;
  readonly label: string;
  readonly icon: typeof Home;
  readonly group: string;
}[] = [
  { id: "home", label: "Start", icon: Home, group: "Menu" },
  { id: "profile", label: "Dane osobowe", icon: UserRound, group: "Profil" },
  { id: "signature", label: "Mój podpis", icon: PenLine, group: "Profil" },
  { id: "salons", label: "Moje salony", icon: Store, group: "Salony" },
  { id: "settings", label: "Ustawienia konta", icon: Settings, group: "Konto" },
] as const;

export function BeautyDocsAccountPanel({
  initialMfa,
  initialProfile,
  memberships,
}: BeautyDocsAccountPanelProps) {
  const t = useT();
  const [profile, setProfile] = useState(initialProfile);
  const [mfa, setMfa] = useState(initialMfa);
  const [mfaChallenge, setMfaChallenge] =
    useState<BeautyDocsMfaChallenge | null>(null);
  const [mfaPhone, setMfaPhone] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaChangeChallengeId, setMfaChangeChallengeId] = useState<string | null>(
    null,
  );
  const [profilePhone, setProfilePhone] = useState(initialProfile.phone ?? "");
  const [activeSection, setActiveSection] = useState<AccountSection>("home");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("security");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signature, setSignature] = useState("");
  const [editingSignature, setEditingSignature] = useState(false);
  const [signatureVersion, setSignatureVersion] = useState(0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createSalonOpen, setCreateSalonOpen] = useState(false);
  const ownedActiveSalons = memberships.filter((m) => m.role === "OWNER");

  const selectSection = (section: AccountSection) => {
    setActiveSection(section);
    if (section === "settings") setSettingsTab("security");
    setMobileMenuOpen(false);
    setMessage(null);
    setError(null);
  };
  const openSettingsTree = () => {
    setActiveSection("settings");
    setSettingsTab("security");
    setMessage(null);
    setError(null);
  };
  const selectSettingsTab = (tab: SettingsTab) => {
    setActiveSection("settings");
    setSettingsTab(tab);
    setMobileMenuOpen(false);
    setMessage(null);
    setError(null);
  };
  const groups = buildAccountGroups(
    activeSection,
    settingsTab,
    selectSection,
    openSettingsTree,
    selectSettingsTab,
  );
  const activeLabel =
    accountNavigation.find((item) => item.id === activeSection)?.label ?? t("Start");
  const firstName = profile.displayName.split(/\s+/).filter(Boolean)[0] ?? "";
  const primaryMembership = memberships[0];

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/beautydocs-preview/auth/profile", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: String(form.get("displayName") ?? "").trim(),
          phone: profilePhone.trim() || null,
        }),
      });
      if (!response.ok) {
        setError(
          response.status === 422
            ? t("Sprawdź imię, nazwisko i numer telefonu.")
            : t("Nie udało się zapisać danych osobowych."),
        );
        return;
      }
      const saved = (await response.json()) as AccountProfile;
      setProfile(saved);
      setProfilePhone(saved.phone ?? "");
      setMessage(t("Dane osobowe zostały zapisane."));
    } catch {
      setError(t("Nie udało się zapisać danych osobowych."));
    } finally {
      setPending(false);
    }
  };

  const saveSignature = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signature) {
      setError(t("Złóż podpis przed zapisaniem."));
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    const response = await fetch(
      "/api/beautydocs-preview/auth/profile/signature",
      {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signature }),
      },
    );
    setPending(false);
    if (!response.ok) {
      setError(t("Nie udało się zapisać podpisu. Spróbuj ponownie."));
      return;
    }
    setProfile((current) => ({
      ...current,
      signatureConfigured: true,
      signatureUpdatedAt: new Date().toISOString(),
    }));
    setSignature("");
    setSignatureVersion((current) => current + 1);
    setEditingSignature(false);
    setMessage(t("Twój podpis został bezpiecznie zaktualizowany."));
  };

  const deleteAccount = async () => {
    setPending(true);
    setError(null);
    const response = await fetch("/api/beautydocs-preview/auth/profile", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation: "USUŃ KONTO" }),
    });
    if (response.ok) {
      window.location.assign("/");
      return;
    }
    setPending(false);
    setError(
      response.status === 409
        ? t("Najpierw zamknij lub przekaż wszystkie salony, których jesteś właścicielem.")
        : t("Nie udało się usunąć konta. Spróbuj ponownie."),
    );
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (newPassword.length < 8) {
      setError(t("Nowe hasło musi mieć co najmniej 8 znaków."));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("Nowe hasła nie są takie same."));
      return;
    }

    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        "/api/beautydocs-preview/auth/profile/password",
        {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            newPassword,
            confirmPassword,
          }),
        },
      );
      if (!response.ok) {
        if (response.status === 401) {
          setError(t("Sesja wygasła. Zaloguj się ponownie."));
        } else {
          setError(t("Nie udało się zmienić hasła. Spróbuj ponownie."));
        }
        return;
      }
      formElement.reset();
      setMessage(
        t("Hasło zostało zmienione. Pozostałe aktywne sesje zostały wylogowane."),
      );
    } catch {
      setError(t("Nie udało się zmienić hasła. Spróbuj ponownie."));
    } finally {
      setPending(false);
    }
  };

  const startMfaEnrollment = async (method: "SMS" | "TOTP") => {
    if (method === "SMS" && mfaPhone.replace(/\D/g, "").length < 8) {
      setError(t("Podaj prawidłowy numer telefonu."));
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        "/api/beautydocs-preview/auth/mfa/enrollment",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            method,
            ...(method === "SMS" ? { phone: mfaPhone } : {}),
            ...(mfaChangeChallengeId
              ? { changeChallengeId: mfaChangeChallengeId }
              : {}),
          }),
        },
      );
      if (!response.ok) {
        setError(mfaEnrollmentError(response.status, method));
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

  const confirmMfaEnrollment = async () => {
    if (!mfaChallenge || !/^\d{6}$/.test(mfaCode)) {
      setError(t("Wpisz pełny 6-cyfrowy kod."));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/beautydocs-preview/auth/mfa/enrollment/confirm",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            challengeId: mfaChallenge.challengeId,
            code: mfaCode,
          }),
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

  const startMfaDisable = async () => {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        "/api/beautydocs-preview/auth/mfa/disable-challenge",
        { method: "POST", credentials: "same-origin" },
      );
      if (!response.ok) throw new Error("mfa-disable-failed");
      setMfaChallenge((await response.json()) as BeautyDocsMfaChallenge);
      setMfaCode("");
    } catch {
      setError(t("Nie udało się rozpocząć wyłączania 2FA."));
    } finally {
      setPending(false);
    }
  };

  const startMfaChange = async () => {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        "/api/beautydocs-preview/auth/mfa/change-challenge",
        { method: "POST", credentials: "same-origin" },
      );
      if (!response.ok) throw new Error("mfa-change-failed");
      setMfaChallenge((await response.json()) as BeautyDocsMfaChallenge);
      setMfaCode("");
    } catch {
      setError(t("Nie udało się rozpocząć zmiany 2FA."));
    } finally {
      setPending(false);
    }
  };

  const confirmMfaChange = async () => {
    if (!mfaChallenge || !/^\d{6}$/.test(mfaCode)) {
      setError(t("Wpisz pełny 6-cyfrowy kod."));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/beautydocs-preview/auth/mfa/change/confirm",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            challengeId: mfaChallenge.challengeId,
            code: mfaCode,
          }),
        },
      );
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

  const confirmMfaDisable = async () => {
    if (!mfaChallenge || !/^\d{6}$/.test(mfaCode)) {
      setError(t("Wpisz pełny 6-cyfrowy kod."));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/beautydocs-preview/auth/mfa/disable/confirm",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            challengeId: mfaChallenge.challengeId,
            code: mfaCode,
          }),
        },
      );
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
      setError(t("Nie udało się potwierdzić wyłączenia 2FA."));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f1] text-[#173d35] lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden min-h-screen border-r border-[#e7ecdf] bg-[#f8fbf5] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <BeautyDocsSidebar
          footer={
            <AccountProfileMenu
              onOpenProfile={() => selectSection("profile")}
              onOpenSettings={() => selectSection("settings")}
              profile={profile}
            />
          }
          groups={groups}
          logoOnClick={() => selectSection("home")}
          subtitle={t("Twoja strefa")}
        />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[#e1e6da] bg-[#fdfffb]/90 px-4 py-3 backdrop-blur-xl sm:px-7 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <button
              aria-label={t("Wróć do strony głównej panelu")}
              className="flex items-center"
              onClick={() => selectSection("home")}
              type="button"
            >
              <BeautyDocsLogo className="text-lg text-[#173d35]" />
            </button>
            <button
              aria-label={mobileMenuOpen ? t("Zamknij menu") : t("Otwórz menu")}
              className="rounded-xl border border-[#dee4d6] bg-white p-2.5 text-[#173d35]"
              onClick={() => setMobileMenuOpen((value) => !value)}
              type="button"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
          <AnimatePresence>
            {mobileMenuOpen ? (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden pt-3"
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
              >
                <BeautyDocsSidebarNav
                  className="grid grid-cols-2 gap-2"
                  compact
                  groups={groups}
                />
                <div className="mt-3 border-t border-[#e5eadd] pt-3">
                  <AccountProfileMenu
                    inline
                    onOpenProfile={() => selectSection("profile")}
                    onOpenSettings={() => selectSection("settings")}
                    profile={profile}
                  />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </header>

        <main className="mx-auto w-full max-w-[1280px] px-4 py-7 sm:px-7 sm:py-10 xl:px-12">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#599687]">
                {t("Twoja strefa")}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#173d35] sm:text-4xl">
                {activeSection === "home"
                  ? t("Dzień dobry{value1}", { value1: firstName ? `, ${firstName}` : "" })
                  : activeLabel}
              </h1>
            </div>
            {primaryMembership ? (
              <Link
                className="inline-flex items-center gap-2 rounded-2xl bg-[#e3ead9] px-4 py-2.5 text-sm font-black text-[#45766a] transition hover:bg-[#d4dfc5]"
                href={`/panel/${encodeURIComponent(primaryMembership.tenantSlug)}`}
              >
                <Store className="size-4" />{" "}{t("Otwórz panel salonu")}
              </Link>
            ) : null}
          </div>

          {message ? (
            <p className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              {t(message)}
            </p>
          ) : null}
          {error ? (
            <p
              className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              initial={{ opacity: 0, y: 10 }}
              key={activeSection}
              transition={{ duration: 0.22 }}
            >
              {activeSection === "home" ? (
                <AccountDashboard
                  memberships={memberships}
                  mfa={mfa}
                  onAddSalon={() => setCreateSalonOpen(true)}
                  onSelect={selectSection}
                  profile={profile}
                />
              ) : null}

              {activeSection === "profile" ? (
                <AccountSectionCard>
                  <SectionHeading
                    description={t("Twoje dane osobowe są niezależne od danych firmy i salonu.")}
                    icon={<UserRound className="size-5" />}
                    title={t("Dane osobowe")}
                  />
                  <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                    <form className="space-y-4" onSubmit={saveProfile}>
                      <label className="block text-xs font-black uppercase tracking-[0.12em] text-stone-500">
                        {t("Imię i nazwisko")}
                        <input
                          className={inputClass}
                          defaultValue={profile.displayName}
                          disabled={pending}
                          maxLength={200}
                          minLength={2}
                          name="displayName"
                          required
                        />
                      </label>
                      <label className="block text-xs font-black uppercase tracking-[0.12em] text-stone-500">
                        {t("Adres e-mail do logowania")}
                        <input
                          className={`${inputClass} bg-stone-50 text-stone-500`}
                          disabled
                          value={profile.email}
                        />
                      </label>
                      <div>
                        <label
                          className="block text-xs font-black uppercase tracking-[0.12em] text-stone-500"
                          htmlFor="account-profile-phone"
                        >
                          {t("Osobisty numer telefonu")}
                        </label>
                        <div className="mt-2">
                        <BeautyDocsPhoneNumberField
                          disabled={pending}
                          id="account-profile-phone"
                          onChange={setProfilePhone}
                          value={profilePhone}
                        />
                        </div>
                        <p className="mt-2 text-xs leading-5 text-stone-500">
                          {t("Numer kontaktowy profilu. Może być inny niż numer używany do kodów 2FA.")}
                        </p>
                      </div>
                      <button className={`${primaryButton} sm:w-auto`} disabled={pending} type="submit">
                        {t("Zapisz dane osobowe")}
                      </button>
                    </form>
                    <PersonalDataSummary memberships={memberships} profile={profile} />
                  </div>
                </AccountSectionCard>
              ) : null}

              {activeSection === "signature" ? (
                <AccountSectionCard>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <SectionHeading
                      description={t("Opcjonalny podpis używany, gdy podpisujesz dokument jako osoba wykonująca zabieg.")}
                      icon={<PenLine className="size-5" />}
                      title={t("Mój podpis")}
                    />
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${
                        profile.signatureConfigured
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {profile.signatureConfigured ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : null}
                      {profile.signatureConfigured ? t("Gotowy") : t("Nieskonfigurowany")}
                    </span>
                  </div>

                  {profile.signatureConfigured && !editingSignature ? (
                    <div className="mt-6 max-w-3xl">
                      <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-2xl border border-[#e5eadf] bg-[#f7f8f4] p-5">
                        <Image
                          alt={t("Twój zapisany podpis")}
                          className="h-auto max-h-40 w-auto max-w-full object-contain"
                          height={180}
                          key={signatureVersion}
                          src={`/api/beautydocs-preview/auth/profile/signature?v=${signatureVersion}`}
                          unoptimized
                          width={620}
                        />
                      </div>
                      <p className="mt-3 text-xs text-stone-500">
                        {t("Ostatnia aktualizacja:")}{" "}{formatDate(profile.signatureUpdatedAt)}
                      </p>
                      <button
                        className={`${primaryButton} mt-4 sm:w-auto`}
                        onClick={() => setEditingSignature(true)}
                        type="button"
                      >
                        {t("Zmień mój podpis")}
                      </button>
                    </div>
                  ) : (
                    <form className="mt-6 max-w-3xl" onSubmit={saveSignature}>
                      <div className="rounded-2xl border border-[#e5eadf] bg-[#f7f8f4] p-4">
                        <BeautyDocsSignaturePad
                          disabled={pending}
                          label={t("Złóż nowy podpis")}
                          onChange={setSignature}
                          required
                          value={signature}
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        {profile.signatureConfigured ? (
                          <button
                            className="rounded-2xl border border-[#d2d9c9] px-5 py-3 text-sm font-black text-stone-600"
                            onClick={() => {
                              setEditingSignature(false);
                              setSignature("");
                            }}
                            type="button"
                          >
                            {t("Anuluj")}
                          </button>
                        ) : null}
                        <button className={`${primaryButton} sm:w-auto`} disabled={pending} type="submit">
                          {t("Zapisz podpis")}
                        </button>
                      </div>
                    </form>
                  )}
                </AccountSectionCard>
              ) : null}

              {activeSection === "salons" ? (
                <AccountSectionCard>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <SectionHeading
                      description={t("Salony, do których masz obecnie dostęp.")}
                      icon={<Store className="size-5" />}
                      title={t("Moje salony")}
                    />
                    <motion.button
                      className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[#245c4d] px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-[#173d35]"
                      onClick={() => setCreateSalonOpen(true)}
                      transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                    >
                      <Plus className="size-4" />{" "}{t("Dodaj salon")}
                    </motion.button>
                  </div>
                  <MembershipGrid
                    memberships={memberships}
                    onAddSalon={() => setCreateSalonOpen(true)}
                  />
                </AccountSectionCard>
              ) : null}

              {activeSection === "settings" ? (
                <AccountSectionCard>
                  <SectionHeading
                    description={
                      settingsTab === "security"
                        ? t("Ustawienia logowania i dodatkowej ochrony konta.")
                        : settingsTab === "language"
                          ? t("Wybierz język menu, formularzy i dokumentów. Zmiana dotyczy tylko Twojego konta.")
                          : t("Operacje dotyczące całego konta użytkownika.")
                    }
                    icon={
                      settingsTab === "security" ? (
                        <ShieldCheck className="size-5" />
                      ) : settingsTab === "language" ? (
                        <Languages className="size-5" />
                      ) : (
                        <UserRound className="size-5" />
                      )
                    }
                    title={
                      settingsTab === "security"
                        ? t("Bezpieczeństwo")
                        : settingsTab === "language"
                          ? t("Język aplikacji")
                          : t("Zarządzanie kontem")
                    }
                  />

                  {settingsTab === "language" ? (
                    <div className="mt-7 max-w-xl border-t border-[#eaeee4] pt-7">
                      <BeautyDocsLanguageList account="owner" />
                    </div>
                  ) : null}

                  {settingsTab === "security" ? (
                    <div className="mt-7 border-t border-[#eaeee4] pt-7">
                      <h3 className="font-black text-[#173d35]">
                        {t("Zmiana hasła")}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-stone-500">
                        {t("Ustaw nowe hasło bez podawania poprzedniego. Inne aktywne sesje konta zostaną automatycznie wylogowane.")}
                      </p>
                      <form
                        className="mt-6 max-w-3xl"
                        onSubmit={changePassword}
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <AccountPasswordInput
                            autoComplete="new-password"
                            disabled={pending}
                            id="account-new-password"
                            label={t("Nowe hasło")}
                            minLength={8}
                            name="newPassword"
                          />
                          <AccountPasswordInput
                            autoComplete="new-password"
                            disabled={pending}
                            id="account-confirm-password"
                            label={t("Powtórz nowe hasło")}
                            minLength={8}
                            name="confirmPassword"
                          />
                        </div>
                        <p className="mt-3 text-xs leading-5 text-stone-500">
                          {t("Hasło musi mieć co najmniej 8 znaków.")}
                        </p>
                        <button
                          className={`${primaryButton} mt-4 sm:w-auto`}
                          disabled={pending}
                          type="submit"
                        >
                          <KeyRound className="mr-2 size-4" />{" "}{t("Zmień hasło")}
                        </button>
                      </form>

                      <div className="mt-8 border-t border-[#eaeee4] pt-7">
                        <h3 className="font-black text-[#173d35]">
                          {t("Weryfikacja dwuetapowa (2FA)")}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-stone-500">
                          {t("Dobrowolna ochrona kodem SMS albo aplikacją uwierzytelniającą.")}
                        </p>
                        <MfaSettings
                          challenge={mfaChallenge}
                          changeChallengeId={mfaChangeChallengeId}
                          code={mfaCode}
                          mfa={mfa}
                          onCancel={() => {
                            setMfaChallenge(null);
                            setMfaChangeChallengeId(null);
                            setMfaCode("");
                          }}
                          onCodeChange={setMfaCode}
                          onConfirmChange={() => void confirmMfaChange()}
                          onConfirmDisable={() => void confirmMfaDisable()}
                          onConfirmEnrollment={() =>
                            void confirmMfaEnrollment()
                          }
                          onPhoneChange={setMfaPhone}
                          onStartChange={() => void startMfaChange()}
                          onStartDisable={() => void startMfaDisable()}
                          onStartEnrollment={(method) =>
                            void startMfaEnrollment(method)
                          }
                          pending={pending}
                          phone={mfaPhone}
                        />
                      </div>
                    </div>
                  ) : null}

                  {settingsTab === "account" ? (
                    <div className="mt-7 border-t border-[#eaeee4] pt-7">
                      <h3 className="font-black text-[#173d35]">{t("Usunięcie konta")}</h3>
                      <p className="mt-1 text-sm leading-6 text-stone-500">
                        {t("Operacje dotyczące całego konta użytkownika.")}
                      </p>
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
                    </div>
                  ) : null}
                </AccountSectionCard>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <BeautyDocsDeleteAccountDialog
        blockedActionLabel={
          ownedActiveSalons.length > 0
            ? t("Otwórz ustawienia salonu „{tenantDisplayName}”", { tenantDisplayName: ownedActiveSalons[0]?.tenantDisplayName })
            : undefined
        }
        blockedItems={ownedActiveSalons.map((membership) => membership.tenantDisplayName)}
        blockedReason={
          ownedActiveSalons.length > 0
            ? t("Zanim usuniesz konto, zamknij lub przekaż własność swoich salonów:")
            : null
        }
        consequences={[
          t("Rozumiem, że mój dostęp i podpis zapisany w profilu zostaną usunięte."),
          t("Rozumiem, że podpisane wcześniej dokumenty salonów mogą pozostać w ograniczonym zakresie wynikającym z obowiązku prawnego lub obrony roszczeń."),
          t("Rozumiem, że tej operacji nie można cofnąć."),
        ]}
        error={error}
        onBlockedAction={
          ownedActiveSalons.length > 0
            ? () => {
                window.location.href = `/panel/${encodeURIComponent(ownedActiveSalons[0]?.tenantSlug ?? "")}/settings`;
              }
            : undefined
        }
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => void deleteAccount()}
        open={deleteDialogOpen}
        pending={pending}
      />
      <BeautyDocsCreateSalonDialog
        onClose={() => setCreateSalonOpen(false)}
        open={createSalonOpen}
      />
    </div>
  );
}

function MfaSettings({
  challenge,
  changeChallengeId,
  code,
  mfa,
  onCancel,
  onCodeChange,
  onConfirmChange,
  onConfirmDisable,
  onConfirmEnrollment,
  onPhoneChange,
  onStartChange,
  onStartDisable,
  onStartEnrollment,
  pending,
  phone,
}: {
  readonly challenge: BeautyDocsMfaChallenge | null;
  readonly changeChallengeId: string | null;
  readonly code: string;
  readonly mfa: BeautyDocsMfaState;
  readonly onCancel: () => void;
  readonly onCodeChange: (value: string) => void;
  readonly onConfirmChange: () => void;
  readonly onConfirmDisable: () => void;
  readonly onConfirmEnrollment: () => void;
  readonly onPhoneChange: (value: string) => void;
  readonly onStartChange: () => void;
  readonly onStartDisable: () => void;
  readonly onStartEnrollment: (method: "SMS" | "TOTP") => void;
  readonly pending: boolean;
  readonly phone: string;
}) {
  const t = useT();
  if (challenge) {
    const disabling = challenge.purpose === "DISABLE";
    const changing = challenge.purpose === "CHANGE";
    return (
      <div className="mt-6 rounded-3xl border border-[#e2e8da] bg-[#fafcf8] p-5 sm:p-6">
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
            <div className="rounded-2xl border border-[#e1e6da] bg-white p-3">
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
            {t("Tryb lokalny — kod:")}{" "}<span className="font-black tracking-widest">{challenge.devCode}</span>
          </p>
        ) : null}

        <label className="mt-5 block max-w-sm text-xs font-black uppercase tracking-[0.12em] text-stone-500">
          {t("Kod 6-cyfrowy")}
          <input
            autoComplete="one-time-code"
            className={`${inputClass} text-center text-lg tracking-[0.35em]`}
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
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className={primaryButton}
            disabled={pending || code.length !== 6}
            onClick={
              disabling
                ? onConfirmDisable
                : changing
                  ? onConfirmChange
                  : onConfirmEnrollment
            }
            type="button"
          >
            {disabling
              ? t("Wyłącz 2FA")
              : changing
                ? t("Potwierdź i wybierz nową metodę")
                : t("Potwierdź i włącz 2FA")}
          </button>
          <button
            className="rounded-2xl border border-[#d2d9c9] px-5 py-3 text-sm font-black text-stone-600"
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

  if (mfa.enabled && changeChallengeId === null) {
    return (
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
            onClick={onStartChange}
            type="button"
          >
            {t("Zmień metodę lub numer")}
          </button>
          <button
            className="rounded-2xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-black text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
            disabled={pending}
            onClick={onStartDisable}
            type="button"
          >
            {t("Wyłącz 2FA")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {changeChallengeId ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 lg:col-span-2">
          {t("Obecne zabezpieczenie nadal działa. Zostanie zastąpione dopiero po potwierdzeniu nowego numeru lub nowej aplikacji.")}
        </div>
      ) : null}
      <div className="rounded-3xl border border-[#e2e8da] bg-[#fafcf8] p-5">
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
            id="account-mfa-phone"
            onChange={onPhoneChange}
            value={phone}
          />
        </div>
        <button
          className={`${primaryButton} mt-4`}
          disabled={pending || phone.replace(/\D/g, "").length < 8}
          onClick={() => onStartEnrollment("SMS")}
          type="button"
        >
          {changeChallengeId ? t("Ustaw nowy numer SMS") : t("Skonfiguruj SMS")}
        </button>
      </div>

      <div className="rounded-3xl border border-[#e2e8da] bg-[#fafcf8] p-5">
        <span className="grid size-10 place-items-center rounded-2xl bg-[#eef3e7] text-[#245c4d]">
          <KeyRound className="size-5" />
        </span>
        <h3 className="mt-4 font-black">{t("Aplikacja uwierzytelniająca")}</h3>
        <p className="mt-2 text-sm leading-6 text-stone-500">
          {t("Działa z Google Authenticator, Microsoft Authenticator i innymi aplikacjami obsługującymi TOTP.")}
        </p>
        <button
          className={`${primaryButton} mt-4`}
          disabled={pending}
          onClick={() => onStartEnrollment("TOTP")}
          type="button"
        >
          {changeChallengeId ? t("Przejdź na aplikację") : t("Skonfiguruj aplikację")}
        </button>
      </div>
      {changeChallengeId ? (
        <button
          className="justify-self-start rounded-2xl border border-[#d2d9c9] px-5 py-3 text-sm font-black text-stone-600 lg:col-span-2"
          disabled={pending}
          onClick={onCancel}
          type="button"
        >
          {t("Anuluj zmianę")}
        </button>
      ) : null}
      <p className="text-xs leading-5 text-stone-500 lg:col-span-2">
        {t("To zabezpieczenie jest dobrowolne. Jeśli go nie włączysz, sposób logowania pozostanie bez zmian.")}
      </p>
    </div>
  );
}

function AccountDashboard({
  memberships,
  mfa,
  onAddSalon,
  onSelect,
  profile,
}: {
  readonly memberships: readonly BeautyDocsAdminMembership[];
  readonly mfa: BeautyDocsMfaState;
  readonly onAddSalon: () => void;
  readonly onSelect: (section: AccountSection) => void;
  readonly profile: AccountProfile;
}) {
  const t = useT();
  const primaryMembership = memberships[0];
  const cards = [
    {
      id: "profile" as const,
      icon: UserRound,
      label: t("Dane osobowe"),
      value: profile.phone ? t("Uzupełnione") : t("Dodaj telefon"),
      complete: true,
    },
    {
      id: "signature" as const,
      icon: PenLine,
      label: t("Mój podpis"),
      value: profile.signatureConfigured ? t("Skonfigurowany") : t("Opcjonalny"),
      complete: profile.signatureConfigured,
    },
    {
      id: "salons" as const,
      icon: Store,
      label: t("Moje salony"),
      value: membershipCountLabel(memberships.length),
      complete: memberships.length > 0,
    },
    {
      id: "settings" as const,
      icon: Settings,
      label: t("Ustawienia konta"),
      value: mfa.enabled ? t("2FA włączone") : "2FA opcjonalne",
      complete: mfa.enabled,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] bg-[#245c4d] p-7 text-white shadow-[0_24px_70px_rgba(52,91,81,0.18)] sm:p-9">
        <div className="absolute -right-14 -top-20 size-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 right-32 size-56 rounded-full bg-[#d2e6b7]/20 blur-2xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_260px] lg:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em]">
              <ShieldCheck className="size-4" />{" "}{t("Konto zweryfikowane")}
            </span>
            <h2 className="mt-5 max-w-2xl text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              {t("Twoje konto i salony w jednym, uporządkowanym miejscu.")}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
              {t("Zarządzaj danymi osobistymi, opcjonalnym podpisem i dostępem do paneli salonów bez szukania ustawień na jednej długiej stronie.")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {primaryMembership ? (
                <Link
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#173d35] transition hover:-translate-y-0.5"
                  href={`/panel/${encodeURIComponent(primaryMembership.tenantSlug)}`}
                >
                  {t("Otwórz salon")}{" "}<ArrowRight className="size-4" />
                </Link>
              ) : null}
              <button
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                onClick={() => onSelect("profile")}
                type="button"
              >
                {t("Ustawienia profilu")}{" "}<ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/60">
              {t("Szybki podgląd")}
            </p>
            <div className="mt-4 space-y-3">
              <StatusRow label={t("Konto")} value="Aktywne" />
              <StatusRow label={t("Salony")} value={String(memberships.length)} />
              <StatusRow
                label={t("Podpis")}
                value={profile.signatureConfigured ? "Gotowy" : "Opcjonalny"}
              />
              <StatusRow label="2FA" value={mfa.enabled ? "Włączone" : "Opcjonalne"} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              className="group rounded-3xl border border-[#e3e8dd] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#bccaa8] hover:shadow-md"
              key={card.id}
              onClick={() => onSelect(card.id)}
              type="button"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#eef3e6] text-[#245c4d]">
                  <Icon className="size-5" />
                </span>
                <span
                  className={`grid size-7 place-items-center rounded-full ${
                    card.complete
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-stone-100 text-stone-400"
                  }`}
                >
                  {card.complete ? (
                    <Check className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </span>
              </div>
              <h3 className="mt-5 font-black text-[#173d35]">{t(card.label)}</h3>
              <p className="mt-1 text-sm text-stone-500">{card.value}</p>
            </button>
          );
        })}
      </div>

      <section className="rounded-[28px] border border-[#e3e8dd] bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-[#599687]">
              {t("Dostępne przestrzenie")}
            </p>
            <h2 className="mt-1 text-xl font-black">{t("Twoje salony")}</h2>
          </div>
          <div className="flex items-center gap-4">
            <motion.button
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d4decc] px-3 py-1.5 text-sm font-black text-[#245c4d] transition-colors hover:bg-[#f7f8f4]"
              onClick={onAddSalon}
              transition={{ type: "spring", bounce: 0, duration: 0.2 }}
              type="button"
              whileTap={{ scale: 0.96 }}
            >
              <Plus className="size-4" />{" "}{t("Dodaj salon")}
            </motion.button>
            <button
              className="inline-flex items-center gap-1 text-sm font-black text-[#245c4d]"
              onClick={() => onSelect("salons")}
              type="button"
            >
              {t("Zobacz wszystkie")}{" "}<ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <MembershipPreview memberships={memberships} onAddSalon={onAddSalon} />
      </section>
    </div>
  );
}

function PersonalDataSummary({
  memberships,
  profile,
}: {
  readonly memberships: readonly BeautyDocsAdminMembership[];
  readonly profile: AccountProfile;
}) {
  const t = useT();
  const primaryRole = memberships[0]?.role;
  const rows = [
    {
      label: t("Status adresu e-mail"),
      value: profile.emailVerifiedAt ? t("Potwierdzony") : t("Niepotwierdzony"),
    },
    {
      label: t("Typ dostępu"),
      value: primaryRole ? roleLabel(primaryRole) : t("Bez przypisanego salonu"),
    },
    {
      label: t("Powiązane salony"),
      value: membershipCountLabel(memberships.length),
    },
    { label: t("Konto utworzone"), value: formatDate(profile.createdAt) },
    { label: t("Ostatnie logowanie"), value: formatDate(profile.lastLoginAt) },
  ];

  return (
    <aside className="rounded-3xl border border-[#e5eadf] bg-[#f7f8f4] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-[#eef3e7] text-[#245c4d]">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h3 className="font-black text-[#173d35]">{t("Informacje o koncie")}</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            {t("Pełny podgląd Twoich danych osobowych")}
          </p>
        </div>
      </div>
      <dl className="mt-5 divide-y divide-[#eaeee4]">
        {rows.map((row) => (
          <div
            className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:gap-4"
            key={row.label}
          >
            <dt className="text-sm text-stone-500">{t(row.label)}</dt>
            <dd className="text-sm font-black text-[#173d35] sm:text-right">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function AccountPasswordInput({
  autoComplete,
  disabled,
  id,
  label,
  minLength,
  name,
}: {
  readonly autoComplete: "new-password";
  readonly disabled: boolean;
  readonly id: string;
  readonly label: string;
  readonly minLength?: number;
  readonly name: string;
}) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  return (
    <label
      className="block text-xs font-black uppercase tracking-[0.12em] text-stone-500"
      htmlFor={id}
    >
      {t(label)}
      <span className="relative mt-2 block">
        <input
          autoComplete={autoComplete}
          className={`${inputClass} mt-0 pr-12`}
          disabled={disabled}
          id={id}
          maxLength={1024}
          minLength={minLength}
          name={name}
          required
          type={visible ? "text" : "password"}
        />
        <button
          aria-label={visible ? t("Ukryj hasło") : t("Pokaż hasło")}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-400 transition hover:text-[#245c4d]"
          disabled={disabled}
          onClick={() => setVisible((value) => !value)}
          type="button"
        >
          {visible ? (
            <EyeOff className="size-[18px]" />
          ) : (
            <Eye className="size-[18px]" />
          )}
        </button>
      </span>
    </label>
  );
}

function AccountProfileMenu({
  inline = false,
  onOpenProfile,
  onOpenSettings,
  profile,
}: {
  readonly inline?: boolean;
  readonly onOpenProfile: () => void;
  readonly onOpenSettings: () => void;
  readonly profile: AccountProfile;
}) {
  const t = useT();
  return (
    <details className="group relative">
      <summary className="flex w-full cursor-pointer list-none items-center gap-2.5 rounded-2xl border border-[#dce1d4] bg-white px-3 py-2.5 transition hover:border-[#b8cbaa] hover:bg-[#f5f8f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] [&::-webkit-details-marker]:hidden">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#245c4d] text-xs font-black text-white">
          {userInitials(profile.displayName)}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[13px] font-black text-[#173d35]">
            {profile.displayName}
          </span>
          <span className="block truncate text-[11px] text-[#5a6b5a]">
            {profile.email}
          </span>
        </span>
        <ChevronUp className="size-4 text-[#808f82] transition group-open:rotate-180" />
      </summary>
      <div
        className={`${
          inline
            ? "relative mt-2 w-full"
            : "absolute bottom-[calc(100%+0.6rem)] left-0 w-64"
        } z-50 overflow-hidden rounded-2xl border border-[#dce1d4] bg-white p-2 shadow-[0_18px_50px_rgba(39,57,52,0.18)]`}
      >
        <div className="border-b border-stone-100 px-3 py-2.5">
          <p className="truncate text-sm font-black text-[#173d35]">
            {profile.displayName}
          </p>
          <p className="mt-0.5 truncate text-xs text-stone-500">{profile.email}</p>
        </div>
        <button
          className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[#414f43] transition hover:bg-[#f5f8f1]"
          onClick={onOpenProfile}
          type="button"
        >
          <UserRound className="size-4" />{" "}{t("Dane osobowe")}
        </button>
        <button
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[#414f43] transition hover:bg-[#f5f8f1]"
          onClick={onOpenSettings}
          type="button"
        >
          <Settings className="size-4" />{" "}{t("Ustawienia konta")}
        </button>
        <div className="mt-1 border-t border-stone-100 pt-1">
          <BeautyDocsLogoutButton
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-black text-red-700 transition hover:bg-red-50 disabled:opacity-50"
            icon={<LogOut className="size-4" />}
            label={t("Wyloguj się")}
          />
        </div>
      </div>
    </details>
  );
}

const MotionLink = motion.create(Link);

function MembershipPreview({
  memberships,
  onAddSalon,
}: {
  readonly memberships: readonly BeautyDocsAdminMembership[];
  readonly onAddSalon: () => void;
}) {
  const t = useT();
  if (!memberships.length) {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-[#d7ddce] px-4 py-8 text-center">
        <p className="text-sm text-stone-500">{t("Nie należysz jeszcze do żadnego salonu.")}</p>
        <motion.button
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#245c4d] px-4 py-2 text-sm font-black text-white transition-colors hover:bg-[#173d35]"
          onClick={onAddSalon}
          transition={{ type: "spring", bounce: 0, duration: 0.2 }}
          type="button"
          whileTap={{ scale: 0.96 }}
        >
          <Plus className="size-4" />{" "}{t("Dodaj salon")}
        </motion.button>
      </div>
    );
  }
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      {memberships.slice(0, 2).map((membership) => (
        <MotionLink
          className="flex items-center gap-4 rounded-2xl bg-[#f8faf6] p-4 transition-colors hover:bg-[#f2f5ed]"
          href={`/panel/${encodeURIComponent(membership.tenantSlug)}`}
          key={membership.tenantSlug}
          transition={{ type: "spring", bounce: 0, duration: 0.2 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#245c4d] shadow-sm">
            <Store className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black">
              {membership.tenantDisplayName}
            </span>
            <span className="block truncate text-xs text-stone-500">
              {t(roleLabel(membership.role))}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-stone-400" />
        </MotionLink>
      ))}
    </div>
  );
}

function MembershipGrid({
  memberships,
  onAddSalon,
}: {
  readonly memberships: readonly BeautyDocsAdminMembership[];
  readonly onAddSalon: () => void;
}) {
  const t = useT();
  if (!memberships.length) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-[#d2d9c9] bg-[#f7f8f4] px-5 py-8 text-center text-sm text-stone-600">
        <p>
          {t("Nie należysz jeszcze do salonu. Po otwarciu linku zaproszenia salon pojawi się tutaj, a Twój podpis pozostanie przypisany do Twojego konta.")}
        </p>
        <motion.button
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#245c4d] px-4 py-2 text-sm font-black text-white transition-colors hover:bg-[#173d35]"
          onClick={onAddSalon}
          transition={{ type: "spring", bounce: 0, duration: 0.2 }}
          type="button"
          whileTap={{ scale: 0.96 }}
        >
          <Plus className="size-4" />{" "}{t("Dodaj swój pierwszy salon")}
        </motion.button>
      </div>
    );
  }
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {memberships.map((membership) => (
        <motion.div
          className="rounded-2xl border border-[#e5eadf] p-5 transition-colors hover:border-[#88b8ac] hover:shadow-md"
          key={membership.tenantSlug}
          transition={{ type: "spring", bounce: 0, duration: 0.2 }}
          whileHover={{ y: -2 }}
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-[#eef3e6] text-[#245c4d]">
            <Store className="size-5" />
          </span>
          <p className="mt-5 font-black">{membership.tenantDisplayName}</p>
          <p className="mt-1 text-sm text-stone-500">{t(roleLabel(membership.role))}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <MotionLink
              className="inline-flex items-center gap-1 rounded-xl bg-[#245c4d] px-3 py-2 text-sm font-black text-white"
              href={`/panel/${encodeURIComponent(membership.tenantSlug)}`}
              transition={{ type: "spring", bounce: 0, duration: 0.2 }}
              whileTap={{ scale: 0.96 }}
            >
              {t("Otwórz panel")}{" "}<ArrowRight className="size-4" />
            </MotionLink>
          </div>
        </motion.div>
      ))}
      <motion.button
        className="flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#c8d2ba] p-5 text-center text-[#245c4d] transition-colors hover:border-[#88b8ac] hover:bg-[#f7f8f4]"
        onClick={onAddSalon}
        transition={{ type: "spring", bounce: 0, duration: 0.2 }}
        type="button"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
      >
        <span className="grid size-11 place-items-center rounded-2xl bg-[#eef3e6]">
          <Plus className="size-5" />
        </span>
        <span className="font-black">{t("Dodaj salon")}</span>
      </motion.button>
    </div>
  );
}

function mfaEnrollmentError(
  status: number,
  method: "SMS" | "TOTP",
): string {
  if (status === 401) {
    return "Sesja wygasła. Zaloguj się ponownie i wróć do konfiguracji 2FA.";
  }
  if (status === 402) {
    return "SMSAPI nie może wysłać kodu, ponieważ konto nadawcy nie ma środków. Doładuj konto SMSAPI albo wybierz aplikację uwierzytelniającą.";
  }
  if (status === 409) {
    return "2FA jest już aktywne. Najpierw wybierz zmianę obecnej metody.";
  }
  if (status === 422) {
    return method === "SMS"
      ? "Numer telefonu jest nieprawidłowy. Sprawdź prefiks kraju i liczbę cyfr."
      : "Nie udało się utworzyć konfiguracji aplikacji uwierzytelniającej.";
  }
  if (status === 429) {
    return "Kod został już wysłany. Odczekaj chwilę przed ponowną próbą.";
  }
  return method === "SMS"
    ? "SMSAPI nie wysłało kodu. Sprawdź saldo, aktywację konta i nazwę nadawcy albo wybierz aplikację uwierzytelniającą."
    : "Nie udało się rozpocząć konfiguracji aplikacji uwierzytelniającej.";
}

function StatusRow({ label, value }: { readonly label: string; readonly value: string }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-white/65">{t(label)}</span>
      <span className="font-black">{value}</span>
    </div>
  );
}

function AccountSectionCard({
  children,
  danger = false,
}: {
  readonly children: ReactNode;
  readonly danger?: boolean;
}) {
  return (
    <section
      className={`rounded-[28px] border bg-white p-6 shadow-sm sm:p-8 ${
        danger ? "border-red-200" : "border-[#e3e8dd]"
      }`}
    >
      {children}
    </section>
  );
}

function SectionHeading({
  title,
  description,
  icon,
}: {
  readonly title: string;
  readonly description: string;
  readonly icon: ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef3e7] text-[#245c4d]">
        {icon}
      </span>
      <div>
        <h2 className="text-xl font-black">{t(title)}</h2>
        <p className="mt-1 text-sm leading-6 text-stone-500">{t(description)}</p>
      </div>
    </div>
  );
}

function buildAccountGroups(
  activeSection: AccountSection,
  settingsTab: SettingsTab,
  onSelect: (section: AccountSection) => void,
  onOpenSettings: () => void,
  onSelectSettings: (tab: SettingsTab) => void,
): BeautyDocsSidebarGroup[] {
  return ["Menu", "Profil", "Salony", "Konto"].map((label) => ({
    label,
    items: accountNavigation
      .filter((item) => item.group === label)
      .map((item) =>
        item.id === "settings"
          ? {
              icon: item.icon,
              label: item.label,
              expanded: activeSection === "settings",
              onClick: onOpenSettings,
              children: [
                {
                  icon: ShieldCheck,
                  label: "Bezpieczeństwo",
                  active:
                    activeSection === "settings" && settingsTab === "security",
                  onClick: () => onSelectSettings("security"),
                },
                {
                  icon: Languages,
                  label: "Język aplikacji",
                  active:
                    activeSection === "settings" && settingsTab === "language",
                  onClick: () => onSelectSettings("language"),
                },
                {
                  icon: UserRound,
                  label: "Zarządzanie kontem",
                  active:
                    activeSection === "settings" && settingsTab === "account",
                  onClick: () => onSelectSettings("account"),
                },
              ],
            }
          : {
              icon: item.icon,
              label: item.label,
              active: activeSection === item.id,
              onClick: () => onSelect(item.id),
            },
      ),
  }));
}

function userInitials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("pl-PL") ?? "")
    .join("");
}

function membershipCountLabel(count: number): string {
  if (count === 1) return "1 salon";
  if (count >= 2 && count <= 4) return `${count} salony`;
  return `${count} salonów`;
}

function formatDate(value: string | null): string {
  if (!value) return "brak daty";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "brak daty"
    : new Intl.DateTimeFormat(activeIntlLocale(), {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

const inputClass =
  "mt-2 w-full rounded-2xl border border-[#d4decc] px-4 py-3 text-sm font-semibold outline-none focus:border-[#245c4d] focus:ring-4 focus:ring-[#245c4d]/10";
const primaryButton =
  "inline-flex w-full items-center justify-center rounded-2xl bg-[#245c4d] px-5 py-3 text-sm font-black text-white transition hover:bg-[#173d35] disabled:opacity-50";
