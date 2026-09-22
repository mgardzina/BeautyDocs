"use client";

import {
  BadgeCheck,
  CheckCircle2,
  CircleUserRound,
  Copy,
  Mail,
  Maximize2,
  PenLine,
  Plus,
  Save,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  BeautyDocsAdminTeam,
  BeautyDocsAdminTeamMember,
  BeautyDocsAdminForm,
  BeautyDocsStaffInvitationCreated,
} from "../../../types/beautydocs-admin";
import { BeautyDocsSignaturePad } from "../forms/BeautyDocsSignaturePad";

interface BeautyDocsTeamManagerProps {
  readonly availableTreatments: readonly BeautyDocsAdminForm[];
  readonly initialTeam: BeautyDocsAdminTeam;
  readonly tenantSlug: string;
}

interface MemberDraft {
  displayName: string;
  email: string;
  jobTitle: string;
  performsTreatments: boolean;
  allTreatments: boolean;
  treatmentCodes: string[];
  isActive: boolean;
}

interface InvitationDraft {
  email: string;
}

const EMPTY_INVITATION: InvitationDraft = {
  email: "",
};

export function BeautyDocsTeamManager({
  availableTreatments,
  initialTeam,
  tenantSlug,
}: BeautyDocsTeamManagerProps) {
  const [members, setMembers] = useState([...initialTeam.items]);
  const [selectedId, setSelectedId] = useState(initialTeam.items[0]?.id ?? null);
  const [showCreate, setShowCreate] = useState(false);
  const [newMember, setNewMember] = useState<InvitationDraft>(EMPTY_INVITATION);
  const [invitation, setInvitation] =
    useState<BeautyDocsStaffInvitationCreated | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => members.find((member) => member.id === selectedId) ?? null,
    [members, selectedId],
  );

  const replaceMember = (updated: BeautyDocsAdminTeamMember) => {
    setMembers((current) =>
      current.map((member) => (member.id === updated.id ? updated : member)),
    );
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newMember.email.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${teamApiPath(tenantSlug)}/invitations`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: newMember.email.trim(),
        }),
      });
      if (response.status === 409) {
        setMessage("Ten adres e-mail jest już przypisany do konta BeautyDocs.");
        return;
      }
      if (!response.ok) throw new Error("invite failed");
      const created = (await response.json()) as BeautyDocsStaffInvitationCreated;
      setInvitation(created);
      setNewMember(EMPTY_INVITATION);
      setShowCreate(false);
      setMessage(`Zaproszenie zostało wysłane na ${created.email}.`);
    } catch {
      setMessage("Nie udało się wysłać zaproszenia. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  };

  const activePractitioners = members.filter(
    (member) => member.isActive && member.performsTreatments,
  ).length;
  const configuredSignatures = members.filter(
    (member) => member.smsSigningReady,
  ).length;

  return (
    <div>
      <header className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 bg-[#f7f8f4] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#245c4d]">
              Zespół salonu
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#173d35] sm:text-3xl">
              Profile i podpisy personelu
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
              Każda osoba wykonująca zabieg potwierdza formularz własnym kodem
              SMS, a następnie składa podpis.
            </p>
          </div>
          {initialTeam.canManage ? (
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#245c4d] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2"
              onClick={() => setShowCreate((value) => !value)}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />
              Dodaj pracownika
            </button>
          ) : null}
        </div>
        <dl className="grid gap-px bg-stone-200 sm:grid-cols-3">
          <TeamStat label="Profile w zespole" value={members.length} />
          <TeamStat label="Wykonują zabiegi" value={activePractitioners} />
          <TeamStat label="Gotowi do podpisu SMS" value={configuredSignatures} />
        </dl>
      </header>

      {message ? (
        <p
          className="mt-4 rounded-xl border border-[#d4decc] bg-[#f3f7ed] px-4 py-3 text-sm font-semibold text-[#245c4d]"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {showCreate ? (
        <CreateMemberForm
          busy={busy}
          draft={newMember}
          onCancel={() => setShowCreate(false)}
          onChange={setNewMember}
          onSubmit={handleCreate}
        />
      ) : null}

      {invitation ? (
        <InvitationReady
          invitation={invitation}
          onClose={() => setInvitation(null)}
        />
      ) : null}

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <header className="border-b border-stone-200 px-5 py-4">
            <h2 className="font-bold text-[#173d35]">Osoby w salonie</h2>
          </header>
          {members.length ? (
            <div className="divide-y divide-stone-100">
              {members.map((member) => (
                <button
                  className={`flex w-full items-center gap-3 px-5 py-4 text-left transition ${
                    selectedId === member.id
                      ? "bg-[#f3f7ed]"
                      : "hover:bg-[#f7f8f4]"
                  }`}
                  key={member.id}
                  onClick={() => setSelectedId(member.id)}
                  type="button"
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                      member.signatureConfigured
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-stone-100 text-stone-400"
                    }`}
                  >
                    {member.signatureConfigured ? (
                      <UserRoundCheck aria-hidden="true" className="size-4.5" />
                    ) : (
                      <CircleUserRound aria-hidden="true" className="size-4.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-[#173d35]">
                        {member.displayName}
                      </span>
                      {member.isOwner ? (
                        <BadgeCheck
                          aria-label="Właściciel salonu"
                          className="size-4 shrink-0 text-[#245c4d]"
                        />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-stone-500">
                      {member.jobTitle ?? "Pracownik salonu"}
                    </span>
                  </span>
                  <span
                    className={`size-2 rounded-full ${
                      member.isActive ? "bg-emerald-500" : "bg-stone-300"
                    }`}
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="px-5 py-12 text-center">
              <UsersRound className="mx-auto size-8 text-stone-300" />
              <p className="mt-3 text-sm text-stone-500">
                Nie dodano jeszcze żadnej osoby.
              </p>
            </div>
          )}
        </section>

        {selected ? (
          <MemberProfile
            availableTreatments={availableTreatments}
            canManage={initialTeam.canManage}
            member={selected}
            onMemberUpdated={replaceMember}
            onMessage={setMessage}
            tenantSlug={tenantSlug}
          />
        ) : null}
      </div>
    </div>
  );
}

function TeamStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white px-5 py-4 sm:px-6">
      <dt className="text-xs font-semibold text-stone-500">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-[#173d35]">{value}</dd>
    </div>
  );
}

function MemberProfile({
  availableTreatments,
  member,
  tenantSlug,
  canManage,
  onMemberUpdated,
  onMessage,
}: {
  availableTreatments: readonly BeautyDocsAdminForm[];
  member: BeautyDocsAdminTeamMember;
  tenantSlug: string;
  canManage: boolean;
  onMemberUpdated: (member: BeautyDocsAdminTeamMember) => void;
  onMessage: (message: string | null) => void;
}) {
  const [draft, setDraft] = useState<MemberDraft>(() => memberToDraft(member));
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const personalDataSelfManaged = member.hasPanelAccess;

  useEffect(() => {
    setDraft(memberToDraft(member));
    setSignature("");
  }, [member]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    onMessage(null);
    try {
      const response = await fetch(
        `${teamApiPath(tenantSlug)}/${encodeURIComponent(member.id)}`,
        {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            displayName: draft.displayName,
            email: draft.email.trim() || null,
            jobTitle: draft.jobTitle.trim() || null,
            performsTreatments: draft.performsTreatments,
            allTreatments: draft.allTreatments,
            treatmentCodes: draft.allTreatments ? [] : draft.treatmentCodes,
            isActive: draft.isActive,
          }),
        },
      );
      if (!response.ok) throw new Error("save failed");
      onMemberUpdated((await response.json()) as BeautyDocsAdminTeamMember);
      onMessage(
        personalDataSelfManaged
          ? "Ustawienia osoby w salonie zostały zapisane."
          : "Dane profilu zostały zapisane.",
      );
    } catch {
      onMessage("Nie udało się zapisać profilu.");
    } finally {
      setBusy(false);
    }
  };

  const saveSignature = async () => {
    if (!signature) {
      onMessage("Najpierw złóż podpis w polu poniżej.");
      return;
    }
    setBusy(true);
    onMessage(null);
    try {
      const response = await fetch(
        `${teamApiPath(tenantSlug)}/${encodeURIComponent(member.id)}/signature`,
        {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ signature }),
        },
      );
      if (!response.ok) throw new Error("signature failed");
      onMemberUpdated((await response.json()) as BeautyDocsAdminTeamMember);
      setSignature("");
      onMessage("Podpis został zapisany i będzie dodawany do nowych formularzy.");
    } catch {
      onMessage("Nie udało się zapisać podpisu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-4 border-b border-stone-200 bg-[#f7f8f4] px-5 py-4 sm:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#245c4d]">
            {member.isOwner ? "Profil właściciela" : "Profil pracownika"}
          </p>
          <h2 className="mt-1 text-xl font-bold text-[#173d35]">
            {member.displayName}
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            member.isActive
              ? "bg-emerald-50 text-emerald-700"
              : "bg-stone-100 text-stone-500"
          }`}
        >
          {member.isActive ? "Aktywny profil" : "Profil nieaktywny"}
        </span>
      </header>

      <form className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6" onSubmit={saveProfile}>
        {personalDataSelfManaged ? (
          <div className="sm:col-span-2 rounded-xl border border-[#d4decc] bg-[#f3f7ed] p-4">
            <p className="text-sm font-bold text-[#245c4d]">
              Dane osobowe zarządzane przez właściciela konta
            </p>
            <p className="mt-1 text-xs leading-5 text-[#245c4d]">
              Imię, nazwisko, e-mail, telefon i podpis ta osoba aktualizuje
              samodzielnie w swoim koncie. Tutaj zmieniasz wyłącznie jej ustawienia
              w salonie.
            </p>
          </div>
        ) : null}
        <TeamInput
          disabled={personalDataSelfManaged}
          label="Imię i nazwisko"
          onChange={(value) => setDraft({ ...draft, displayName: value })}
          required
          value={draft.displayName}
        />
        <TeamInput
          label="Stanowisko"
          onChange={(value) => setDraft({ ...draft, jobTitle: value })}
          placeholder="np. kosmetolog"
          value={draft.jobTitle}
        />
        <div className="sm:col-span-2">
          <TeamInput
            disabled={personalDataSelfManaged}
            label="E-mail (opcjonalnie)"
            onChange={(value) => setDraft({ ...draft, email: value })}
            type="email"
            value={draft.email}
          />
        </div>
        <div className="sm:col-span-2 rounded-xl border border-stone-200 bg-[#f7f8f4] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#5a6b5a]">
            Telefon do kodów SMS
          </p>
          {member.phone ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-bold text-[#173d35]">
              {member.phone}
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-black text-emerald-700">
                dodany przez właściciela konta
              </span>
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-stone-500">
              Brak numeru. Ta osoba dodaje i potwierdza go samodzielnie w „Dane
              osobowe” w swoim koncie — numer jest osobisty, więc nie ustawiasz go
              tutaj.
            </p>
          )}
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-stone-200 p-4">
          <input
            checked={draft.performsTreatments}
            className="mt-0.5 size-4 accent-[#245c4d]"
            disabled={!canManage}
            onChange={(event) =>
              setDraft({ ...draft, performsTreatments: event.target.checked })
            }
            type="checkbox"
          />
          <span>
            <span className="block text-sm font-bold text-[#173d35]">
              Wykonuje zabiegi
            </span>
            <span className="mt-1 block text-xs leading-5 text-stone-500">
              Osoba pojawi się na liście wyboru w formularzu klientki.
            </span>
          </span>
        </label>
        <div className="sm:col-span-2">
          <TreatmentAssignments
            allTreatments={draft.allTreatments}
            availableTreatments={availableTreatments}
            disabled={!canManage || !draft.performsTreatments}
            onAllTreatmentsChange={(allTreatments) =>
              setDraft({ ...draft, allTreatments })
            }
            onTreatmentCodesChange={(treatmentCodes) =>
              setDraft({ ...draft, treatmentCodes })
            }
            treatmentCodes={draft.treatmentCodes}
          />
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-stone-200 p-4">
          <input
            checked={draft.isActive}
            className="mt-0.5 size-4 accent-[#245c4d]"
            disabled={!canManage || member.isOwner}
            onChange={(event) =>
              setDraft({ ...draft, isActive: event.target.checked })
            }
            type="checkbox"
          />
          <span>
            <span className="block text-sm font-bold text-[#173d35]">
              Aktywny profil
            </span>
            <span className="mt-1 block text-xs leading-5 text-stone-500">
              Nieaktywnych osób nie można wybrać w nowych formularzach.
            </span>
          </span>
        </label>
        {canManage ? (
          <div className="sm:col-span-2">
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-[#cdd7c6] bg-white px-4 py-2.5 text-sm font-bold text-[#245c4d] transition hover:bg-[#f3f7ed] disabled:opacity-50"
              disabled={busy}
              type="submit"
            >
              <Save aria-hidden="true" className="size-4" />
              {personalDataSelfManaged
                ? "Zapisz ustawienia w salonie"
                : "Zapisz dane profilu"}
            </button>
          </div>
        ) : null}
      </form>

      <div className="border-t border-stone-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-[#173d35]">
              {member.isOwner ? "Podpis właściciela salonu" : "Podpis pracownika"}
            </h3>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              Podpis z profilu pozostaje wzorem. Każdy formularz wymaga osobnego
              kodu SMS oraz świadomego podpisania przez wykonawcę.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
              member.signatureConfigured
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-800"
            }`}
          >
            {member.signatureConfigured ? (
              <CheckCircle2 aria-hidden="true" className="size-3.5" />
            ) : (
              <PenLine aria-hidden="true" className="size-3.5" />
            )}
            {member.signatureConfigured ? "Podpis zapisany" : "Brak podpisu"}
          </span>
        </div>

        {member.signatureConfigured ? (
          <figure className="mt-4 rounded-xl border border-stone-200 bg-[#f7f8f4] p-3">
            <figcaption className="mb-2 text-xs font-semibold text-stone-500">
              Aktualny podpis
            </figcaption>
            <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
              <Image
                alt={`Podpis — ${member.displayName}`}
                className="h-auto max-h-36 w-full object-contain"
                height={200}
                key={member.signatureUpdatedAt}
                src={`${teamApiPath(tenantSlug)}/${encodeURIComponent(member.id)}/signature`}
                unoptimized
                width={720}
              />
            </div>
          </figure>
        ) : null}

        {personalDataSelfManaged ? (
          <div className="mt-5 rounded-xl border border-[#d4decc] bg-[#f3f7ed] px-4 py-3 text-sm leading-6 text-[#245c4d]">
            To jest podpis osobisty. Właściciel konta może go dodać lub zmienić
            samodzielnie w swoim panelu, w sekcji „Mój podpis”.
          </div>
        ) : canManage ? (
          <div className="mt-5">
            <BeautyDocsSignaturePad
              label={
                member.signatureConfigured
                  ? "Złóż nowy podpis, aby zastąpić obecny"
                  : "Złóż podpis"
              }
              onChange={setSignature}
              value={signature}
            />
            <button
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#245c4d] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#173d35] disabled:opacity-50"
              disabled={busy || !signature}
              onClick={saveSignature}
              type="button"
            >
              <PenLine aria-hidden="true" className="size-4" />
              Zapisz podpis
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CreateMemberForm({
  draft,
  busy,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: InvitationDraft;
  busy: boolean;
  onChange: (draft: InvitationDraft) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      className="mt-5 rounded-2xl border border-[#d4decc] bg-white p-5 shadow-sm sm:p-6"
      onSubmit={onSubmit}
    >
      <h2 className="text-lg font-bold text-[#173d35]">Zaproś pracownika</h2>
      <p className="mt-1 text-sm text-stone-500">
        Podaj tylko adres e-mail — wyślemy jednorazowy link aktywacyjny (lub kod
        QR). Stanowisko i pozostałe ustawienia dodasz później, gdy pracownik
        dołączy do salonu.
      </p>
      <div className="mt-5">
        <TeamInput
          label="E-mail pracownika"
          onChange={(value) => onChange({ ...draft, email: value })}
          required
          type="email"
          value={draft.email}
        />
      </div>
      <div className="mt-5 flex gap-3">
        <button
          className="rounded-xl bg-[#245c4d] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          Wyślij zaproszenie
        </button>
        <button
          className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-bold text-stone-600"
          onClick={onCancel}
          type="button"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}

function InvitationReady({
  invitation,
  onClose,
}: {
  invitation: BeautyDocsStaffInvitationCreated;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const localOnlyLink = isLocalOnlyInvitationUrl(invitation.activationUrl);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitation.activationUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <Mail className="size-3.5" /> Zaproszenie wysłane
          </span>
          <h2 className="mt-4 text-xl font-bold text-[#173d35]">
            {invitation.email}
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Link działa tylko raz i wygasa{" "}
            {formatInvitationExpiry(invitation.expiresAt)}. Kod QR prowadzi do
            tego samego bezpiecznego formularza aktywacji.
          </p>
          {localOnlyLink ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
              Ten link używa adresu localhost i nie otworzy się na innym urządzeniu.
              Ustaw publiczny adres aplikacji albo adres komputera w sieci Wi-Fi.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-[#245c4d] px-4 py-2.5 text-sm font-bold text-white"
              onClick={() => void copyLink()}
              type="button"
            >
              <Copy className="size-4" /> {copied ? "Skopiowano" : "Kopiuj link"}
            </button>
            <button
              className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-bold text-stone-600"
              onClick={onClose}
              type="button"
            >
              Zamknij
            </button>
          </div>
        </div>
        <figure className="rounded-2xl border border-stone-200 bg-[#f7f8f4] p-3 text-center">
          <button
            aria-label="Powiększ kod QR zaproszenia pracownika"
            className="group relative mx-auto block rounded-xl bg-white p-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#245c4d]/20"
            onClick={() => setExpanded(true)}
            type="button"
          >
            <Image
              alt="Kod QR zaproszenia pracownika"
              className="size-48 object-contain [image-rendering:pixelated]"
              height={192}
              src={invitation.qrCodeDataUrl}
              unoptimized
              width={192}
            />
            <span className="absolute bottom-2 right-2 grid size-9 place-items-center rounded-xl bg-[#173d35] text-white shadow-lg transition group-hover:scale-105">
              <Maximize2 className="size-4" />
            </span>
          </button>
          <figcaption className="mt-2 text-xs font-semibold text-stone-500">
            <button
              className="inline-flex items-center gap-1.5 font-bold text-[#245c4d]"
              onClick={() => setExpanded(true)}
              type="button"
            >
              <Maximize2 className="size-3.5" /> Powiększ kod QR
            </button>
          </figcaption>
        </figure>
      </div>

      {expanded ? (
        <div
          aria-label="Powiększony kod QR zaproszenia pracownika"
          aria-modal="true"
          className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-[#173d35]/70 p-4 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
          role="dialog"
        >
          <div
            className="relative w-full max-w-xl rounded-[30px] bg-white p-5 shadow-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              aria-label="Zamknij powiększony kod QR"
              className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
              onClick={() => setExpanded(false)}
              type="button"
            >
              <X className="size-5" />
            </button>
            <div className="mx-auto max-w-[440px] pt-8 text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                <Mail className="size-3.5" /> Zaproszenie do {invitation.salonName}
              </span>
              <h3 className="mt-4 text-xl font-bold text-[#173d35]">
                Zeskanuj kod telefonem pracownika
              </h3>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                Kod otworzy jednorazowy formularz aktywacji konta dla {invitation.email}.
              </p>
              <div className="mt-5 rounded-3xl border-2 border-stone-200 bg-white p-4 sm:p-6">
                <Image
                  alt="Powiększony kod QR zaproszenia pracownika"
                  className="h-auto w-full [image-rendering:pixelated]"
                  height={440}
                  src={invitation.qrCodeDataUrl}
                  unoptimized
                  width={440}
                />
              </div>
              {localOnlyLink ? (
                <p className="mt-4 text-xs font-semibold leading-5 text-amber-700">
                  Telefon musi mieć dostęp do adresu aplikacji widocznego w linku.
                </p>
              ) : (
                <p className="mt-4 text-xs leading-5 text-stone-500">
                  Link jest jednorazowy i wygaśnie {formatInvitationExpiry(invitation.expiresAt)}.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function isLocalOnlyInvitationUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return true;
  }
}

function formatInvitationExpiry(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function TeamInput({
  disabled = false,
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
}: {
  disabled?: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "email" | "tel";
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#5a6b5a]">
        {label}
        {required ? <span className="text-[#245c4d]"> *</span> : null}
      </span>
      <input
        className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-[#173d35] outline-none transition focus:border-[#245c4d] focus:ring-2 focus:ring-[#245c4d]/15 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function memberToDraft(member: BeautyDocsAdminTeamMember): MemberDraft {
  return {
    displayName: member.displayName,
    email: member.email ?? "",
    jobTitle: member.jobTitle ?? "",
    performsTreatments: member.performsTreatments,
    allTreatments: member.allTreatments,
    treatmentCodes: [...member.treatmentCodes],
    isActive: member.isActive,
  };
}

function TreatmentAssignments({
  allTreatments,
  availableTreatments,
  disabled,
  onAllTreatmentsChange,
  onTreatmentCodesChange,
  treatmentCodes,
}: {
  readonly allTreatments: boolean;
  readonly availableTreatments: readonly BeautyDocsAdminForm[];
  readonly disabled: boolean;
  readonly onAllTreatmentsChange: (value: boolean) => void;
  readonly onTreatmentCodesChange: (codes: string[]) => void;
  readonly treatmentCodes: readonly string[];
}) {
  const toggleTreatment = (code: string, checked: boolean) => {
    onTreatmentCodesChange(
      checked
        ? [...new Set([...treatmentCodes, code])]
        : treatmentCodes.filter((item) => item !== code),
    );
  };

  return (
    <fieldset
      className={`rounded-2xl border border-stone-200 bg-[#f7f8f4] p-4 sm:p-5 ${
        disabled ? "opacity-60" : ""
      }`}
      disabled={disabled}
    >
      <legend className="px-1 text-sm font-black text-[#173d35]">
        Przypisane zabiegi
      </legend>
      <p className="mt-1 text-xs leading-5 text-stone-500">
        W formularzu klientki pokażemy tę osobę tylko przy przypisanych zabiegach.
      </p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[#d4decc] bg-white p-3.5">
        <input
          checked={allTreatments}
          className="mt-0.5 size-4 accent-[#245c4d]"
          onChange={(event) => onAllTreatmentsChange(event.target.checked)}
          type="checkbox"
        />
        <span>
          <span className="block text-sm font-bold text-[#173d35]">
            Wszystkie aktywne zabiegi
          </span>
          <span className="mt-0.5 block text-xs text-stone-500">
            Obejmuje również zabiegi dodane w przyszłości.
          </span>
        </span>
      </label>
      {!allTreatments ? (
        availableTreatments.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {availableTreatments.map((treatment) => {
              const checked = treatmentCodes.includes(treatment.code);
              return (
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition ${
                    checked
                      ? "border-[#b7c99e] bg-[#f3f8ec]"
                      : "border-stone-200 bg-white hover:border-[#cdd7c6]"
                  }`}
                  key={treatment.code}
                >
                  <input
                    checked={checked}
                    className="size-4 accent-[#245c4d]"
                    onChange={(event) =>
                      toggleTreatment(treatment.code, event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[#173d35]">
                      {treatment.name}
                    </span>
                    <span className="block text-xs text-stone-500">
                      {treatment.durationMinutes} min
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-3 text-xs font-semibold text-amber-800">
            Najpierw włącz co najmniej jeden formularz zabiegowy.
          </p>
        )
      ) : null}
    </fieldset>
  );
}

function teamApiPath(tenantSlug: string): string {
  return `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}/team`;
}
