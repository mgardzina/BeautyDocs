"use client";

import { useT } from "../i18n";
import { useRef, useState, type FormEvent } from "react";
import {
  Clock3,
  ImagePlus,
  Loader2,
  Lock,
  Trash2,
} from "lucide-react";
import { Tabs } from "radix-ui";
import type {
  BeautyDocsTenantOverview,
  BeautyDocsBookingDay,
  BeautyDocsBookingSchedule,
  BeautyDocsTenantSettings,
} from "../../../types/beautydocs-admin";

import { BeautyDocsSalonProfileEditor } from "./BeautyDocsSalonProfileEditor";

type SettingsSection = "company" | "profile" | "calendar" | "access";

const SETTINGS_TABS = [
  { value: "company", label: "Dane salonu" },
  { value: "profile", label: "Strona salonu" },
  { value: "calendar", label: "Kalendarz" },
  { value: "access", label: "Dostęp i zarządzanie" },
] as const;
const SURFACE_CLASS = "rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-8 lg:p-10";
const PRIMARY_BUTTON_CLASS = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#173d35] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#354537] disabled:cursor-not-allowed disabled:opacity-50";

export function BeautyDocsTenantSettingsPanel({
  initialSettings,
  capabilities,
}: {
  readonly initialSettings: BeautyDocsTenantSettings;
  readonly capabilities: BeautyDocsTenantOverview["capabilities"] | null;
}) {
  const t = useT();
  const deletePhrase = t("USUŃ SALON");
  const [settings, setSettings] = useState(initialSettings);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [directoryVisible, setDirectoryVisible] = useState(
    initialSettings.directoryVisible,
  );
  const [bookingSchedule, setBookingSchedule] =
    useState<BeautyDocsBookingSchedule>(initialSettings.bookingSchedule);
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("company");
  const [logoImage, setLogoImage] = useState(initialSettings.logoImage);
  const [logoPending, setLogoPending] = useState(false);

  const saveLogo = async (dataUrl: string | null) => {
    setLogoPending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(settings.slug)}/logo`,
        {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        },
      );
      if (!response.ok) {
        setError(
          response.status === 400 || response.status === 422
            ? t("Nieprawidłowy plik logo. Użyj pliku PNG, JPG lub WebP.")
            : t("Nie udało się zapisać logo salonu."),
        );
        return;
      }
      const saved = (await response.json()) as BeautyDocsTenantSettings;
      setSettings(saved);
      setLogoImage(saved.logoImage);
      setMessage(
        dataUrl === null
          ? t("Logo salonu zostało usunięte.")
          : t("Logo salonu zostało zapisane."),
      );
    } catch {
      setError(t("Nie udało się zapisać logo salonu."));
    } finally {
      setLogoPending(false);
    }
  };

  const persistSettings = async (
    payload: Omit<
      BeautyDocsTenantSettings,
      "slug" | "countryCode" | "role" | "canEdit" | "canDelete" | "logoImage"
    >,
    successMessage: string,
    verifyBookingSchedule = false,
  ) => {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(settings.slug)}/settings`,
        {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        setError(t("Nie udało się zapisać ustawień salonu."));
        return;
      }
      const savedSettings = (await response.json()) as BeautyDocsTenantSettings;
      if (
        verifyBookingSchedule &&
        !bookingSchedulesEqual(
          savedSettings.bookingSchedule,
          payload.bookingSchedule,
        )
      ) {
        setSettings({ ...savedSettings, bookingSchedule: payload.bookingSchedule });
        setBookingSchedule(payload.bookingSchedule);
        setError(
          t("Nie udało się potwierdzić zapisu grafiku. Odśwież stronę i spróbuj ponownie."),
        );
        return;
      }
      setSettings(savedSettings);
      if (verifyBookingSchedule) setBookingSchedule(savedSettings.bookingSchedule);
      else setDirectoryVisible(savedSettings.directoryVisible);
      setMessage(successMessage);
    } catch {
      setError(t("Nie udało się zapisać zmian. Sprawdź połączenie i spróbuj ponownie."));
    } finally {
      setPending(false);
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    await persistSettings(
      {
        displayName: value("displayName"),
        legalName: value("legalName"),
        nip: value("nip") || null,
        regon: value("regon") || null,
        krs: value("krs") || null,
        email: value("email"),
        privacyContactEmail: settings.privacyContactEmail,
        phone: value("phone") || null,
        websiteUrl: settings.websiteUrl,
        addressLine1: value("addressLine1") || null,
        addressLine2: settings.addressLine2,
        postalCode: value("postalCode") || null,
        city: value("city") || null,
        directoryVisible,
        bookingSchedule: settings.bookingSchedule,
      },
      t("Ustawienia salonu zostały zapisane."),
    );
  };

  const saveCalendar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const automaticSchedule = {
      ...bookingSchedule,
      slotIntervalMinutes: 30 as const,
    };
    await persistSettings(
      {
        displayName: settings.displayName,
        legalName: settings.legalName,
        nip: settings.nip,
        regon: settings.regon,
        krs: settings.krs,
        email: settings.email,
        privacyContactEmail: settings.privacyContactEmail,
        phone: settings.phone,
        websiteUrl: settings.websiteUrl,
        addressLine1: settings.addressLine1,
        addressLine2: settings.addressLine2,
        postalCode: settings.postalCode,
        city: settings.city,
        directoryVisible: settings.directoryVisible,
        bookingSchedule: automaticSchedule,
      },
      t("Ustawienia kalendarza zostały zapisane."),
      true,
    );
  };

  const deleteSalon = async () => {
    if (confirmation.trim().toLocaleUpperCase() !== deletePhrase.toLocaleUpperCase()) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(settings.slug)}/settings`,
        {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirmation }),
        },
      );
      if (response.ok) {
        window.location.assign("/panel");
        return;
      }
      setError(
        response.status === 403
          ? t("Tylko właściciel może zamknąć salon.")
          : t("Nie udało się zamknąć salonu. Spróbuj ponownie."),
      );
    } catch {
      setError(t("Nie udało się zamknąć salonu. Sprawdź połączenie i spróbuj ponownie."));
    } finally {
      setPending(false);
    }
  };

  const formDisabled = !settings.canEdit || pending || logoPending;

  return (
    <div className="mx-auto w-full max-w-[54rem] pb-10 pt-2 sm:pt-5 lg:pt-7">
      <header className="mb-7 sm:mb-9">
        <h1 className="text-3xl font-semibold leading-tight tracking-[-0.035em] text-[#173d35] sm:text-4xl">
          {t("Ustawienia")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#5a6b5a]">
          {t("Profil salonu, godziny przyjęć i dostęp do Twojej przestrzeni.")}
        </p>
      </header>

      <Tabs.Root value={activeSection} onValueChange={(value) => setActiveSection(value as SettingsSection)}>
        <Tabs.List aria-label={t("Sekcje ustawień salonu")} className="mb-7 flex gap-6 overflow-x-auto border-b border-[#e2e5dd] sm:mb-9 sm:gap-9">
          {SETTINGS_TABS.map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="relative min-h-12 shrink-0 border-b-2 border-transparent px-1 pb-4 pt-2 text-sm font-semibold text-[#5a6b5a] transition-colors hover:text-[#173d35] data-[state=active]:border-[#245c4d] data-[state=active]:text-[#245c4d]"
            >
              {t(tab.label)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div role="status" aria-live="polite" aria-atomic="true">
          {message ? <p className="mb-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{t(message)}</p> : null}
        </div>
        {error ? <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p> : null}
        {!settings.canEdit ? <p className="mb-6 text-sm leading-6 text-[#5a6b5a]">{t("Masz dostęp tylko do odczytu. Dane może zmienić właściciel lub administrator salonu.")}</p> : null}

        <Tabs.Content value="profile" forceMount className="outline-none data-[state=inactive]:hidden"><BeautyDocsSalonProfileEditor slug={settings.slug} canEdit={settings.canEdit} visible={settings.directoryVisible} /></Tabs.Content>

        <Tabs.Content value="company" forceMount className="outline-none data-[state=inactive]:hidden">
          <form className={SURFACE_CLASS} onSubmit={save}>
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-[#173d35] sm:text-2xl">{t("Profil salonu")}</h2>
            <p className="mt-2 text-sm leading-6 text-[#5a6b5a]">{t("Tak Twój salon widzą klientki w BeautyDocs.")}</p>

            <LogoUploader
              canEdit={settings.canEdit}
              displayName={settings.displayName}
              logoImage={logoImage}
              onRemove={() => void saveLogo(null)}
              onSelect={(dataUrl) => void saveLogo(dataUrl)}
              onError={setError}
              pending={logoPending || pending}
            />

            <div className="mt-8 space-y-6">
              <SettingsField defaultValue={settings.displayName} disabled={formDisabled} label={t("Nazwa salonu")} name="displayName" required />
              <SettingsField defaultValue={settings.email} disabled={formDisabled} label={t("E-mail kontaktowy")} name="email" required type="email" />
              <SettingsField defaultValue={settings.phone ?? ""} disabled={formDisabled} label={t("Telefon salonu")} name="phone" type="tel" />
            </div>

            <fieldset className="mt-9 min-w-0 border-t border-[#ebeee8] pt-8">
              <legend className="sr-only">{t("Dane firmy")}</legend>
              <h3 className="text-lg font-semibold tracking-tight text-[#173d35]">{t("Dane firmy")}</h3>
              <p className="mb-6 mt-2 text-sm leading-6 text-[#5a6b5a]">{t("Wykorzystywane w nowych formularzach i klauzulach dla klientek.")}</p>
              <div className="space-y-6">
                <SettingsField defaultValue={settings.legalName} disabled={formDisabled} label={t("Pełna nazwa firmy")} locked={Boolean(settings.legalName)} name="legalName" required />
                <SettingsField defaultValue={settings.nip ?? ""} disabled={formDisabled} label="NIP" locked={Boolean(settings.nip)} name="nip" />
                <div className="grid gap-6 sm:grid-cols-2">
                  <SettingsField defaultValue={settings.regon ?? ""} disabled={formDisabled} label="REGON" locked={Boolean(settings.regon)} name="regon" />
                  <SettingsField defaultValue={settings.krs ?? ""} disabled={formDisabled} label={t("KRS (opcjonalnie)")} locked={Boolean(settings.krs)} name="krs" />
                </div>
                {settings.legalName || settings.nip || settings.regon || settings.krs ? (
                  <p className="flex items-start gap-2 text-xs leading-5 text-[#5a6b5a]">
                    <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                    {t("Pełną nazwę firmy oraz numery NIP, REGON i KRS można ustawić raz i nie da się ich później zmienić — to dane identyfikacyjne firmy, które nie zmieniają się z roku na rok. W razie pomyłki napisz do nas. Nazwę salonu widoczną w aplikacji zmienisz w polu „Nazwa salonu” powyżej.")}
                  </p>
                ) : null}
              </div>
            </fieldset>

            <fieldset className="mt-9 min-w-0 border-t border-[#ebeee8] pt-8">
              <legend className="sr-only">{t("Adres salonu")}</legend>
              <h3 className="mb-6 text-lg font-semibold tracking-tight text-[#173d35]">{t("Adres salonu")}</h3>
              <div className="space-y-6">
                <SettingsField defaultValue={settings.addressLine1 ?? ""} disabled={formDisabled} label={t("Ulica i numer")} name="addressLine1" />
                <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <SettingsField defaultValue={settings.postalCode ?? ""} disabled={formDisabled} label={t("Kod pocztowy")} name="postalCode" />
                  <SettingsField defaultValue={settings.city ?? ""} disabled={formDisabled} label={t("Miejscowość")} name="city" />
                </div>
              </div>
            </fieldset>

            <label className="mt-9 flex min-h-11 cursor-pointer items-center justify-between gap-5 border-t border-[#ebeee8] pt-7">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#173d35]">{t("Pokaż salon w wyszukiwarce")}</span>
                <span className="mt-1.5 block text-sm leading-6 text-[#5a6b5a]">{t("Klientki mogą znaleźć salon po nazwie i miejscowości.")}</span>
              </span>
              <span className="relative inline-flex h-11 w-12 shrink-0 items-center">
                <input checked={directoryVisible} className="peer sr-only" disabled={formDisabled}
                  name="directoryVisible" onChange={(event) => setDirectoryVisible(event.target.checked)} type="checkbox" role="switch" />
                <span className="absolute inset-x-0 top-2 h-7 rounded-full bg-stone-300 transition-colors peer-checked:bg-[#245c4d] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[#245c4d] peer-disabled:opacity-50" />
                <span className="pointer-events-none absolute left-1 top-3 size-5 rounded-full bg-white shadow-sm transition-transform duration-150 peer-checked:translate-x-5 motion-reduce:transition-none" />
              </span>
            </label>

            {settings.canEdit ? (
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <button className={PRIMARY_BUTTON_CLASS} disabled={pending || logoPending} type="submit">
                  {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                  {pending ? t("Zapisywanie…") : t("Zapisz zmiany")}
                </button>
                <p className="text-xs leading-5 text-[#5a6b5a]">{t("Zmiany danych zatwierdzisz przyciskiem. Logo zapisuje się od razu.")}</p>
              </div>
            ) : null}
          </form>
        </Tabs.Content>

        <Tabs.Content value="calendar" forceMount className="outline-none data-[state=inactive]:hidden">
          <CalendarSettingsSection canEdit={settings.canEdit} onChange={setBookingSchedule}
            onSubmit={saveCalendar} pending={pending || logoPending} schedule={bookingSchedule} />
        </Tabs.Content>

        <Tabs.Content value="access" forceMount className="space-y-6 outline-none data-[state=inactive]:hidden">
          <section className={SURFACE_CLASS} aria-labelledby="account-access-heading">
            <h2 id="account-access-heading" className="text-xl font-semibold tracking-[-0.025em] sm:text-2xl">{t("Dostęp do salonu")}</h2>
            <p className="mt-2 text-sm leading-6 text-[#5a6b5a]">{t("Uprawnienia przypisane do Twojego konta w tym salonie.")}</p>
            {capabilities ? (
              <dl className="mt-6 divide-y divide-[#ebeee8]">
                {[
                  { label: t("Podgląd klientek"), enabled: capabilities.canViewClients },
                  { label: t("Zarządzanie klientkami"), enabled: capabilities.canManageClients },
                  { label: t("Zarządzanie formularzami"), enabled: capabilities.canManageForms },
                  { label: t("Zarządzanie zespołem"), enabled: capabilities.canManageMembers },
                ].map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-5 py-4 text-sm">
                    <dt className="font-medium">{t(item.label)}</dt>
                    <dd className="shrink-0 text-[#5a6b5a]">{item.enabled ? t("Dostęp") : t("Brak dostępu")}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className="mt-6 text-sm text-[#5a6b5a]">{t("Nie udało się pobrać uprawnień. Odśwież stronę, aby spróbować ponownie.")}</p>}
          </section>

          {settings.canDelete ? (
            <section className={SURFACE_CLASS}>
              <h2 className="text-xl font-semibold tracking-tight">{t("Zarządzanie salonem")}</h2>
              <p className="mt-2 text-sm leading-6 text-[#5a6b5a]">{t("Zamknięcie salonu nie usuwa Twojego konta BeautyDocs.")}</p>
              <details className="group mt-6 border-t border-[#ebeee8] pt-2">
                <summary className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg text-sm font-semibold text-red-800">
                  <Trash2 aria-hidden="true" className="size-4" />{" "}{t("Zamknij i usuń salon")}
                </summary>
                <div className="pb-1 pt-4">
                  <p className="text-sm leading-6 text-[#5a6b5a]">
                    {t("Dostęp do panelu i formularzy publicznych zostanie natychmiast wyłączony. Dane niepotrzebne do rozliczeń, obowiązków prawnych lub obrony roszczeń zostaną następnie usunięte albo zanonimizowane zgodnie z polityką retencji.")}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#5a6b5a]">{t("Konto użytkownika usuniesz osobno w: Profil → Ustawienia konta → Zarządzanie kontem.")}</p>
                  <label className="mt-6 block text-sm font-medium text-[#173d35]">
                    {t("Wpisz „{phrase}”, aby potwierdzić", { phrase: deletePhrase })}
                    <input className="mt-2 min-h-12 w-full rounded-xl border border-red-200 px-4 py-3 text-base outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                      autoComplete="off" disabled={pending || logoPending} onChange={(event) => setConfirmation(event.target.value)} value={confirmation} />
                  </label>
                  <button className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={pending || logoPending || confirmation.trim().toLocaleUpperCase() !== deletePhrase.toLocaleUpperCase()} onClick={() => void deleteSalon()} type="button">
                    {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                    {pending ? t("Zamykanie…") : t("Zamknij i usuń salon")}
                  </button>
                </div>
              </details>
            </section>
          ) : null}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function bookingSchedulesEqual(
  first: BeautyDocsBookingSchedule,
  second: BeautyDocsBookingSchedule,
): boolean {
  if (first.slotIntervalMinutes !== second.slotIntervalMinutes) return false;
  return second.days.every((expectedDay) => {
    const savedDay = first.days.find(
      (day) => day.weekday === expectedDay.weekday,
    );
    return (
      savedDay?.enabled === expectedDay.enabled &&
      savedDay.opensAt === expectedDay.opensAt &&
      savedDay.closesAt === expectedDay.closesAt
    );
  });
}

function CalendarSettingsSection({
  canEdit,
  onChange,
  onSubmit,
  pending,
  schedule,
}: {
  readonly canEdit: boolean;
  readonly onChange: (schedule: BeautyDocsBookingSchedule) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly pending: boolean;
  readonly schedule: BeautyDocsBookingSchedule;
}) {
  const t = useT();
  const invalidDays = schedule.days.filter((day) => {
    const opensAt = clockMinutes(day.opensAt);
    const closesAt = clockMinutes(day.closesAt);
    return opensAt === null || closesAt === null || closesAt - opensAt < 60;
  });
  const enabledDays = schedule.days.filter((day) => day.enabled).length;

  function updateDay(
    weekday: number,
    update: Partial<Pick<BeautyDocsBookingDay, "enabled" | "opensAt" | "closesAt">>,
  ) {
    onChange({
      ...schedule,
      days: schedule.days.map((day) =>
        day.weekday === weekday ? { ...day, ...update } : day,
      ),
    });
  }

  return (
    <section className={SURFACE_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.025em] text-[#173d35] sm:text-2xl">{t("Godziny przyjęć")}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#5a6b5a]">{t("Ustal, kiedy klientki mogą rezerwować wizyty. Czas zabiegu zależy od wybranego formularza.")}</p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs font-medium text-[#5a6b5a]">
          <Clock3 aria-hidden="true" className="size-4" />
          {enabledDays === 0 ? t("Rezerwacje wyłączone") : `${enabledDays} ${enabledDays === 1 ? t("dzień") : "dni"} w tygodniu`}
        </span>
      </div>

      <form className="mt-7" onSubmit={onSubmit}>
        <div className="divide-y divide-[#ebeee8]">
          {schedule.days.map((day) => {
            const invalid = invalidDays.some((invalidDay) => invalidDay.weekday === day.weekday);
            const dayLabel = WEEKDAY_LABELS[day.weekday];
            return (
              <div key={day.weekday} className="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:items-center sm:gap-6">
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <span className="relative inline-flex h-11 w-11 shrink-0 items-center">
                    <input checked={day.enabled} className="peer sr-only" disabled={!canEdit || pending}
                      onChange={(event) => updateDay(day.weekday, { enabled: event.target.checked })} type="checkbox" role="switch" />
                    <span className="absolute inset-x-0 top-2.5 h-6 rounded-full bg-stone-300 transition-colors peer-checked:bg-[#245c4d] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[#245c4d] peer-disabled:opacity-50" />
                    <span className="pointer-events-none absolute left-1 top-3.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-150 peer-checked:translate-x-5 motion-reduce:transition-none" />
                  </span>
                  <span className="text-sm font-medium text-[#173d35]">{t(dayLabel)}</span>
                </label>
                {day.enabled ? (
                  <div className="min-w-0">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
                      <CalendarTimeField disabled={!canEdit || pending} label={t("Od")} accessibleLabel={`${dayLabel} — od`}
                        errorId={invalid ? `schedule-error-${day.weekday}` : undefined}
                        onChange={(opensAt) => updateDay(day.weekday, { opensAt })} value={day.opensAt} />
                      <span aria-hidden="true" className="pb-3.5 text-[#5a6b5a]">–</span>
                      <CalendarTimeField disabled={!canEdit || pending} label={t("Do")} accessibleLabel={`${dayLabel} — do`}
                        errorId={invalid ? `schedule-error-${day.weekday}` : undefined}
                        onChange={(closesAt) => updateDay(day.weekday, { closesAt })} value={day.closesAt} />
                    </div>
                    {invalid ? <p id={`schedule-error-${day.weekday}`} className="mt-2 text-sm text-red-700" role="alert">{t("Zakres musi obejmować co najmniej 60 minut.")}</p> : null}
                  </div>
                ) : <p className="text-sm text-[#5a6b5a] sm:text-right">{t("Salon nieczynny")}</p>}
              </div>
            );
          })}
        </div>
        {canEdit ? (
          <div className="mt-5 border-t border-[#ebeee8] pt-7">
            <button className={PRIMARY_BUTTON_CLASS} disabled={pending || invalidDays.length > 0} type="submit">
              {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {pending ? t("Zapisywanie…") : t("Zapisz zmiany")}
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}

function CalendarTimeField({
  disabled,
  label,
  accessibleLabel,
  errorId,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly accessibleLabel: string;
  readonly errorId?: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  const t = useT();
  return (
    <label className="block min-w-0 text-xs font-medium text-[#5a6b5a]">
      {t(label)}
      <input
        className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-[#d5d8d0] bg-white px-3 py-2.5 text-base font-normal tabular-nums text-[#173d35] outline-none transition-colors focus:border-[#245c4d] focus:ring-2 focus:ring-[#245c4d]/15 disabled:bg-stone-50 disabled:text-[#5a6b5a]"
        aria-label={accessibleLabel}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        step={900}
        type="time"
        value={value}
      />
    </label>
  );
}

const WEEKDAY_LABELS = [
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
  "Sobota",
  "Niedziela",
] as const;

function clockMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || ![0, 15, 30, 45].includes(minute)) return null;
  return hour * 60 + minute;
}

const LOGO_MAX_DIMENSION = 256;
const LOGO_MAX_INPUT_BYTES = 6 * 1024 * 1024;
const LOGO_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

async function resizeLogoToDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Nie udało się wczytać obrazu."));
      element.src = objectUrl;
    });
    const scale = Math.min(
      1,
      LOGO_MAX_DIMENSION / Math.max(image.width, image.height),
    );
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Brak obsługi canvas.");
    context.drawImage(image, 0, 0, width, height);
    // PNG preserves transparency for logos on colored surfaces.
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function LogoUploader({
  canEdit,
  displayName,
  logoImage,
  onSelect,
  onRemove,
  onError,
  pending,
}: {
  readonly canEdit: boolean;
  readonly displayName: string;
  readonly logoImage: string | null;
  readonly onSelect: (dataUrl: string) => void;
  readonly onRemove: () => void;
  readonly onError: (message: string) => void;
  readonly pending: boolean;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!LOGO_ACCEPTED_TYPES.includes(file.type)) {
      onError(t("Nieobsługiwany format. Użyj pliku PNG, JPG lub WebP."));
      return;
    }
    if (file.size > LOGO_MAX_INPUT_BYTES) {
      onError(t("Plik jest zbyt duży. Maksymalny rozmiar to 6 MB."));
      return;
    }
    try {
      const dataUrl = await resizeLogoToDataUrl(file);
      onSelect(dataUrl);
    } catch {
      onError(t("Nie udało się przetworzyć obrazu. Spróbuj inny plik."));
    }
  };

  return (
    <div className="mt-8">
      <h3 className="text-sm font-medium text-[#173d35]">{t("Logo salonu")}</h3>
      <div className="mt-3 flex flex-wrap items-center gap-5">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-[#e2e5dd] bg-[#f7f8f4]">
          {logoImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={t("Logo salonu {displayName}", { displayName: displayName })}
              className="size-full object-contain"
              src={logoImage}
            />
          ) : (
            <ImagePlus aria-hidden="true" className="size-6 text-[#245c4d]" />
          )}
        </span>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-3">
            <input
              accept={LOGO_ACCEPTED_TYPES.join(",")}
              className="hidden"
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
              ref={inputRef}
              type="file"
            />
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#eff0ed] px-4 py-2.5 text-sm font-semibold text-[#173d35] transition-colors hover:bg-[#e4e7e1] disabled:opacity-50"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              {pending ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <ImagePlus aria-hidden="true" className="size-4" />
              )}
              {logoImage ? t("Zmień logo") : t("Dodaj logo")}
            </button>
            {logoImage ? (
              <button
                className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-[#5a6b5a] transition-colors hover:bg-[#f7f8f4] disabled:opacity-50"
                disabled={pending}
                onClick={onRemove}
                type="button"
              >
                <Trash2 className="size-4" />{" "}{t("Usuń")}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-stone-500">
            {t("Tylko właściciel lub administrator może zmienić logo.")}
          </p>
        )}
      </div>
      <p className="mt-3 text-xs leading-5 text-[#5a6b5a]">{t("PNG, JPG lub WebP, do 6 MB. Logo pojawi się w formularzach i wyszukiwarce salonów.")}</p>
    </div>
  );
}

function SettingsField({
  label,
  name,
  defaultValue,
  disabled,
  locked = false,
  required = false,
  type = "text",
}: {
  readonly label: string;
  readonly name: string;
  readonly defaultValue: string;
  readonly disabled: boolean;
  readonly locked?: boolean;
  readonly required?: boolean;
  readonly type?: "email" | "tel" | "text";
}) {
  const t = useT();
  return (
    <label className="block min-w-0 text-sm font-medium text-[#173d35]">
      <span className="flex items-center gap-1.5">
        {t(label)}
        {locked ? <Lock aria-hidden="true" className="size-3.5 text-[#5a6b5a]" /> : null}
      </span>
      <input
        aria-readonly={locked || undefined}
        className={`mt-2 min-h-[3.25rem] w-full min-w-0 rounded-xl border border-[#d5d8d0] px-4 py-3 text-base font-normal text-[#173d35] outline-none transition-colors focus:border-[#245c4d] focus:ring-2 focus:ring-[#245c4d]/15 disabled:bg-stone-50 disabled:text-[#5a6b5a] ${locked ? "cursor-not-allowed bg-stone-50 text-[#5a6b5a]" : "bg-white"}`}
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
        readOnly={locked}
        required={required}
        type={type}
      />
    </label>
  );
}
