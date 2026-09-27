"use client";
import { activeIntlLocale } from "../../../lib/i18n/active";

import { useT } from "../i18n";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ClipboardCheck,
  FileCheck2,
  Hash,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  PenLine,
  ShieldCheck,
  UserRound,
  UserRoundCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  BeautyDocsAdminClientFormDetail as ClientFormDetail,
  BeautyDocsAdminFormAnswer,
  BeautyDocsSubmissionStatus,
} from "../../../types/beautydocs-admin";
import { canDownloadFormPdf } from "@/lib/beautydocs-pdf-eligibility";
import { BeautyDocsPdfDownload } from "../forms/BeautyDocsPdfDownload";
import { BeautyDocsSignaturePad } from "../forms/BeautyDocsSignaturePad";
import { BeautyDocsTreatmentAreaVisualization } from "../forms/BeautyDocsTreatmentAreaVisualization";

interface BeautyDocsClientFormDetailProps {
  readonly detail: ClientFormDetail;
  readonly tenantSlug: string;
}

const CONSENT_SIGNATURE_KEYS: Readonly<Record<string, string>> = {
  zgodaWykonanieZabiegu: "podpisDane",
  zgodaPrzetwarzanieDanych: "podpisRodo",
  zgodaMarketing: "podpisMarketing",
  zgodaFotografie: "podpisFotografie",
};

export function BeautyDocsClientFormDetail({
  detail,
  tenantSlug,
}: BeautyDocsClientFormDetailProps) {
  const t = useT();
  const { client, submission } = detail;
  const clientPath =
    `/panel/${encodeURIComponent(tenantSlug)}` +
    `/clients/${encodeURIComponent(client.id)}`;
  const consentKeys = new Set(
    detail.sections
      .flatMap((section) => section.items)
      .filter((answer) => answer.kind === "consent")
      .map((answer) => answer.key),
  );
  const linkedSignatureKeys = new Set(
    [...consentKeys]
      .map((key) => CONSENT_SIGNATURE_KEYS[key])
      .filter((key): key is string => Boolean(key)),
  );

  return (
    <article aria-labelledby="client-form-heading">
      <Link
        className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-stone-600 hover:text-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2"
        href={clientPath}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("Wróć do profilu klientki")}
      </Link>

      <header className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 bg-[#f7f8f4] p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#245c4d] text-white">
                <ClipboardCheck aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-500">
                  {t("Wypełniony formularz")}
                </p>
                <h1
                  className="mt-1 text-2xl font-bold tracking-tight text-[#173d35] sm:text-3xl"
                  id="client-form-heading"
                >
                  {submission.templateName}
                </h1>
                <p className="mt-2 text-sm text-stone-500">
                  {t("Wersja formularza")}{" "}{submission.templateVersion}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <SubmissionStatusBadge status={submission.status} />
              <BeautyDocsPdfDownload eligible={canDownloadFormPdf(submission.status, detail.printMetadata?.clientSignedAt ?? submission.submittedAt, detail.practitioner?.signedAt, detail.signatureKeys)} documentId={submission.id} href={`/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}/clients/${encodeURIComponent(client.id)}/forms/${encodeURIComponent(submission.id)}/pdf`} />
            </div>
          </div>
        </div>

        <dl className="grid gap-px bg-stone-200 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryItem
            icon={UserRound}
            label={t("Klientka")}
            value={`${client.firstName} ${client.lastName}`}
          />
          <SummaryItem
            icon={CalendarDays}
            label={submission.submittedAt ? t("Data wysłania") : t("Data utworzenia")}
            value={formatDateTime(submission.submittedAt ?? submission.createdAt)}
          />
          <SummaryItem
            icon={PenLine}
            label={t("Podpis")}
            value={detail.signatureKeys.length > 0 ? "Podpis złożony" : "Brak podpisu"}
          />
          <SummaryItem
            icon={FileCheck2}
            label={t("Dokument")}
            value={detail.documentHash ? "Utrwalony" : "Wersja robocza"}
          />
        </dl>
      </header>

      {detail.anatomy && detail.treatmentAreaIds.length > 0 ? (
        <section className="mt-6 overflow-hidden rounded-2xl border border-[#d4decc] bg-white shadow-sm">
          <header className="flex items-start gap-3 border-b border-[#e5eadf] bg-[#f7f8f4] px-5 py-4 sm:px-6">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eef3e7] text-[#245c4d]">
              <MapPin aria-hidden="true" className="size-4" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#245c4d]">
                {t("Wizualizacja obszaru zabiegu")}
              </p>
              <h2 className="mt-1 text-lg font-bold text-[#173d35]">
                {t("Zaznaczone miejsca")}
              </h2>
            </div>
          </header>
          <div className="p-5 sm:p-6">
            <BeautyDocsTreatmentAreaVisualization
              anatomy={detail.anatomy}
              selectedIds={detail.treatmentAreaIds}
            />
          </div>
        </section>
      ) : null}

      <div className="mt-6 space-y-5">
        {detail.sections.length > 0 ? (
          detail.sections
            .filter((section) =>
              section.items.some(
                (answer) =>
                  answer.kind !== "signature" ||
                  !linkedSignatureKeys.has(answer.key),
              ),
            )
            .map((section, index) => (
            <section
              className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
              key={`${section.key}-${index}`}
            >
              <header className="border-b border-stone-200 px-5 py-4 sm:px-6">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#245c4d]">
                  {t("Sekcja")}{" "}{index + 1}
                </p>
                <h2 className="mt-1 text-lg font-bold text-[#173d35]">
                  {t(section.title)}
                </h2>
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
                      ? CONSENT_SIGNATURE_KEYS[answer.key]
                      : answer.kind === "signature"
                        ? answer.key
                        : undefined;
                  return (
                  <AnswerRow
                    answer={answer}
                    key={`${answer.key}-${answerIndex}`}
                    signatureImageUrl={
                      signatureKey && detail.signatureKeys.includes(signatureKey)
                        ? buildSignatureImageUrl(
                            tenantSlug,
                            client.id,
                            submission.id,
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
          <section className="rounded-2xl border border-stone-200 bg-white px-5 py-12 text-center shadow-sm sm:px-6">
            <ClipboardCheck
              aria-hidden="true"
              className="mx-auto size-8 text-stone-300"
            />
            <h2 className="mt-4 font-bold text-[#173d35]">
              {t("Brak zapisanych odpowiedzi")}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {t("Formularz został utworzony, ale klientka nie zapisała jeszcze żadnych danych.")}
            </p>
          </section>
        )}
      </div>

      {detail.practitioner ? (
        <section className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <header className="border-b border-stone-200 px-5 py-4 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#245c4d]">
              {t("Personel salonu")}
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#173d35]">
              {t("Osoba wykonująca zabieg")}
            </h2>
          </header>
          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef3e7] text-[#245c4d]">
                <UserRoundCheck aria-hidden="true" className="size-4.5" />
              </span>
              <div>
                <p className="font-bold text-[#173d35]">
                  {detail.practitioner.displayName}
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  {detail.practitioner.jobTitle ?? t("Osoba wykonująca zabieg")}
                </p>
                <p className="mt-3 text-xs leading-5 text-stone-500">
                  {t("Przypisana osoba potwierdza swój numer SMS-em i składa podpis dopiero po sprawdzeniu formularza klientki.")}
                </p>
              </div>
            </div>
            {detail.practitioner.signatureConfigured ? (
              <figure className="rounded-xl border border-stone-200 bg-[#f7f8f4] p-3">
                <figcaption className="mb-2 text-xs font-semibold text-stone-500">
                  {t("Podpis osoby wykonującej zabieg")}
                </figcaption>
                <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                  <Image
                    alt={t("Podpis wykonawcy — {displayName}", { displayName: detail.practitioner.displayName })}
                    className="h-auto max-h-44 w-full object-contain"
                    height={240}
                    src={buildPractitionerSignatureImageUrl(
                      tenantSlug,
                      client.id,
                      submission.id,
                    )}
                    unoptimized
                    width={720}
                  />
                </div>
                {detail.practitioner.verificationDestinationMasked &&
                detail.practitioner.verificationVerifiedAt ? (
                  <p className="mt-3 text-xs leading-5 text-stone-500">
                    {t("Numer")}{" "}{detail.practitioner.verificationDestinationMasked}{" "}
                    {t("potwierdzono kodem SMS")}{" "}
                    {new Intl.DateTimeFormat(activeIntlLocale(), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(
                      new Date(
                        detail.practitioner.verificationVerifiedAt,
                      ),
                    )}
                    .
                  </p>
                ) : null}
              </figure>
            ) : detail.practitioner.canCurrentUserSign ? (
              <PractitionerSigningPanel
                clientId={client.id}
                practitionerName={detail.practitioner.displayName}
                submissionId={submission.id}
                tenantSlug={tenantSlug}
              />
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                {submission.status === "SUBMITTED"
                  ? t("Formularz oczekuje na potwierdzenie SMS i podpis osoby przypisanej do zabiegu ({displayName}). Może go złożyć tylko ta osoba, zalogowana na swoje konto.", { displayName: detail.practitioner.displayName })
                  : t("Ten dokument nie zawiera podpisu osoby wykonującej zabieg. Klientki i osoby wykonującej zabieg to dwa osobne podpisy.")}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {detail.documentHash ? (
        <section className="mt-5 rounded-2xl border border-stone-200 bg-[#f7f8f4] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-stone-500 shadow-sm">
              <Hash aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#173d35]">
                {t("Integralność dokumentu")}
              </h2>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                {t("Odcisk SHA-256 pozwala potwierdzić, że utrwalona treść formularza nie została zmieniona.")}
              </p>
              <code className="mt-3 block break-all rounded-lg bg-white px-3 py-2 text-xs text-stone-600">
                {detail.documentHash}
              </code>
            </div>
          </div>
        </section>
      ) : null}
    </article>
  );
}

type PractitionerSigningStage =
  | "idle"
  | "sending"
  | "otp"
  | "verifying"
  | "signing"
  | "submitting";

function PractitionerSigningPanel({
  tenantSlug,
  clientId,
  submissionId,
  practitionerName,
}: {
  readonly tenantSlug: string;
  readonly clientId: string;
  readonly submissionId: string;
  readonly practitionerName: string;
}) {
  const t = useT();
  const router = useRouter();
  const [stage, setStage] = useState<PractitionerSigningStage>("idle");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [destinationMasked, setDestinationMasked] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [signature, setSignature] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const basePath =
    `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}` +
    `/clients/${encodeURIComponent(clientId)}` +
    `/forms/${encodeURIComponent(submissionId)}`;

  const start = async () => {
    setStage("sending");
    setMessage(null);
    try {
      const response = await fetch(`${basePath}/practitioner-verification`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("start failed");
      const value = (await response.json()) as {
        verificationId: string;
        destinationMasked: string;
        devCode: string | null;
      };
      setVerificationId(value.verificationId);
      setDestinationMasked(value.destinationMasked);
      setDevCode(value.devCode);
      setStage("otp");
    } catch {
      setMessage(
        t("Nie udało się wysłać kodu. Sprawdź numer telefonu w swoim profilu."),
      );
      setStage("idle");
    }
  };

  const verify = async () => {
    if (verificationId === null || !/^\d{6}$/.test(code)) return;
    setStage("verifying");
    setMessage(null);
    try {
      const response = await fetch(
        `${basePath}/practitioner-verification/confirm`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ verificationId, code }),
        },
      );
      if (!response.ok) throw new Error("verify failed");
      setStage("signing");
    } catch {
      setMessage(t("Kod jest nieprawidłowy lub wygasł."));
      setStage("otp");
    }
  };

  const sign = async () => {
    if (verificationId === null || !signature) return;
    setStage("submitting");
    setMessage(null);
    try {
      const response = await fetch(`${basePath}/practitioner-signature`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ verificationId, signature }),
      });
      if (!response.ok) throw new Error("sign failed");
      router.refresh();
    } catch {
      setMessage(
        t("Nie udało się podpisać formularza. Kod mógł wygasnąć — rozpocznij ponownie."),
      );
      setStage("idle");
    }
  };

  return (
    <div className="rounded-xl border border-[#d4decc] bg-[#f7f8f4] p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eef3e7] text-[#245c4d]">
          {stage === "signing" || stage === "submitting" ? (
            <PenLine aria-hidden="true" className="size-4" />
          ) : (
            <LockKeyhole aria-hidden="true" className="size-4" />
          )}
        </span>
        <div>
          <h3 className="text-sm font-bold text-[#173d35]">
            {t("Podpis wykonawcy —")}{" "}{practitionerName}
          </h3>
          <p className="mt-1 text-xs leading-5 text-stone-500">
            {t("Najpierw potwierdź swój numer kodem SMS, a następnie podpisz niezmienioną wersję formularza klientki.")}
          </p>
        </div>
      </div>

      {message ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          {t(message)}
        </p>
      ) : null}

      {stage === "idle" || stage === "sending" ? (
        <button
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#245c4d] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          disabled={stage === "sending"}
          onClick={start}
          type="button"
        >
          <MessageSquareText aria-hidden="true" className="size-4" />
          {stage === "sending" ? t("Wysyłanie kodu…") : t("Wyślij kod SMS")}
        </button>
      ) : null}

      {stage === "otp" || stage === "verifying" ? (
        <div className="mt-4">
          <p className="text-xs font-semibold text-stone-600">
            {t("Kod wysłano na")}{" "}{destinationMasked}.
          </p>
          {devCode ? (
            <p className="mt-2 text-xs text-amber-800">
              {t("Tryb lokalny — kod:")}{" "}<strong>{devCode}</strong>
            </p>
          ) : null}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              autoComplete="one-time-code"
              className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-4 py-3 text-center text-lg font-black tracking-[0.3em] outline-none focus:border-[#245c4d]"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="••••••"
              value={code}
            />
            <button
              className="rounded-xl bg-[#245c4d] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              disabled={stage === "verifying" || code.length !== 6}
              onClick={verify}
              type="button"
            >
              {stage === "verifying" ? t("Sprawdzanie…") : t("Potwierdź kod")}
            </button>
          </div>
        </div>
      ) : null}

      {stage === "signing" || stage === "submitting" ? (
        <div className="mt-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold text-emerald-700">
            <ShieldCheck aria-hidden="true" className="size-4" />
            {t("Numer potwierdzony — podpis został odblokowany.")}
          </p>
          <BeautyDocsSignaturePad
            label={t("Podpis osoby wykonującej zabieg")}
            onChange={setSignature}
            required
            value={signature}
          />
          <button
            className="mt-4 w-full rounded-xl bg-[#245c4d] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            disabled={stage === "submitting" || !signature}
            onClick={sign}
            type="button"
          >
            {stage === "submitting"
              ? t("Zapisywanie podpisu…")
              : t("Podpisz i zatwierdź formularz")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SummaryItem({
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
    <div className="bg-white p-5 sm:p-6">
      <dt className="flex items-center gap-2 text-xs font-semibold text-stone-500">
        <Icon aria-hidden="true" className="size-3.5" />
        {t(label)}
      </dt>
      <dd className="mt-2 text-sm font-bold text-[#222a23]">{value}</dd>
    </div>
  );
}

function AnswerRow({
  answer,
  signatureImageUrl,
}: {
  readonly answer: BeautyDocsAdminFormAnswer;
  readonly signatureImageUrl: string | null;
}) {
  const t = useT();
  const detailPresentation = getAnswerDetailPresentation(answer.kind);

  return (
    <div className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] sm:gap-8 sm:px-6 sm:py-5">
      <dt className="text-sm font-semibold leading-6 text-[#173d35]">
        {t(answer.label)}
      </dt>
      <dd className="min-w-0">
        <AnswerValue
          answer={answer}
          signatureImageUrl={signatureImageUrl}
        />
        {answer.detail ? (
          <div
            className={`mt-3 rounded-xl border px-4 py-3 ${detailPresentation.containerClasses}`}
          >
            <p className={`text-xs font-bold ${detailPresentation.headingClasses}`}>
              {t(detailPresentation.heading)}
            </p>
            <p className={`mt-2 whitespace-pre-wrap break-words text-sm leading-6 ${detailPresentation.textClasses}`}>
              {t(answer.detail)}
            </p>
          </div>
        ) : null}
      </dd>
    </div>
  );
}

function getAnswerDetailPresentation(
  kind: BeautyDocsAdminFormAnswer["kind"],
): {
  readonly heading: string;
  readonly containerClasses: string;
  readonly headingClasses: string;
  readonly textClasses: string;
} {
  if (kind === "contraindication") {
    return {
      heading: "Doprecyzowanie odpowiedzi",
      containerClasses: "border-amber-200 bg-amber-50",
      headingClasses: "text-amber-900",
      textClasses: "text-amber-900",
    };
  }
  if (kind === "consent") {
    return {
      heading: "Treść udzielonej zgody",
      containerClasses: "border-[#d4decc] bg-[#fafcf8]",
      headingClasses: "text-[#245c4d]",
      textClasses: "text-[#173d35]",
    };
  }
  if (kind === "signature") {
    return {
      heading: "Treść podpisanego dokumentu",
      containerClasses: "border-stone-200 bg-[#f7f8f4]",
      headingClasses: "text-stone-700",
      textClasses: "text-[#173d35]",
    };
  }
  return {
    heading: "Szczegóły",
    containerClasses: "border-stone-200 bg-[#f7f8f4]",
    headingClasses: "text-stone-700",
    textClasses: "text-[#173d35]",
  };
}

function AnswerValue({
  answer,
  signatureImageUrl,
}: {
  readonly answer: BeautyDocsAdminFormAnswer;
  readonly signatureImageUrl: string | null;
}) {
  const t = useT();
  const value = answer.value?.trim() ?? "";
  if (value === "") {
    return <span className="text-sm italic text-stone-400">{t("Nie udzielono odpowiedzi")}</span>;
  }

  if (answer.kind === "signature") {
    return (
      <div>
        <BooleanAnswer positive label={t("Podpis złożony")} />
        <ClientSignatureFigure label={t(answer.label)} url={signatureImageUrl} />
      </div>
    );
  }

  if (answer.kind === "consent") {
    const accepted = isPositiveAnswer(value);
    return (
      <div>
        <BooleanAnswer
          label={accepted ? t("Zaakceptowano") : t("Nie zaakceptowano")}
          positive={accepted}
        />
        <ClientSignatureFigure label={t(answer.label)} url={signatureImageUrl} />
      </div>
    );
  }

  if (answer.kind === "contraindication" && isBooleanLike(value)) {
    const positive = isPositiveAnswer(value);
    return (
      <BooleanAnswer
        label={positive ? t("Tak") : t("Nie")}
        positive={!positive}
      />
    );
  }

  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#173d35]">
      {humanizeStoredValue(value)}
    </p>
  );
}

function ClientSignatureFigure({
  label,
  url,
}: {
  readonly label: string;
  readonly url: string | null;
}) {
  const t = useT();
  if (!url) return null;
  return (
    <figure className="mt-3 rounded-xl border border-stone-200 bg-[#f7f8f4] p-3">
      <figcaption className="mb-2 text-xs font-semibold text-stone-500">
        {t("Podpis potwierdzający tę decyzję")}
      </figcaption>
      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <Image
          alt={t("Podpis klientki — {label}", { label: label })}
          className="h-auto max-h-44 w-full object-contain"
          height={240}
          src={url}
          unoptimized
          width={720}
        />
      </div>
    </figure>
  );
}

function BooleanAnswer({
  positive,
  label,
}: {
  readonly positive: boolean;
  readonly label: string;
}) {
  const t = useT();
  const Icon = positive ? Check : X;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
        positive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-700"
      }`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {t(label)}
    </span>
  );
}

function SubmissionStatusBadge({
  status,
}: {
  readonly status: BeautyDocsSubmissionStatus;
}) {
  const t = useT();
  const values = {
    DRAFT: { label: t("Szkic"), classes: "bg-stone-100 text-stone-600" },
    SUBMITTED: { label: t("Wysłany"), classes: "bg-[#eef3e7] text-[#245c4d]" },
    SIGNED: { label: t("Podpisany"), classes: "bg-emerald-50 text-emerald-700" },
    VOID: { label: t("Unieważniony"), classes: "bg-red-50 text-red-700" },
  } as const;
  const value = values[status];

  return (
    <span
      className={`inline-flex self-start rounded-full px-3 py-1.5 text-xs font-bold ${value.classes}`}
    >
      {t(value.label)}
    </span>
  );
}

function isPositiveAnswer(value: string): boolean {
  return ["true", "yes", "tak", "1", "accepted", "signed"].includes(
    value.toLocaleLowerCase("pl-PL"),
  );
}

function isBooleanLike(value: string): boolean {
  return [
    "true",
    "false",
    "yes",
    "no",
    "tak",
    "nie",
    "1",
    "0",
  ].includes(value.toLocaleLowerCase("pl-PL"));
}

function humanizeStoredValue(value: string): string {
  if (value === "true") {
    return "Tak";
  }
  if (value === "false") {
    return "Nie";
  }
  return value;
}

function buildSignatureImageUrl(
  tenantSlug: string,
  clientId: string,
  submissionId: string,
  signatureKey: string,
): string {
  return (
    `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}` +
    `/clients/${encodeURIComponent(clientId)}` +
    `/forms/${encodeURIComponent(submissionId)}` +
    `/signatures/${encodeURIComponent(signatureKey)}`
  );
}

function buildPractitionerSignatureImageUrl(
  tenantSlug: string,
  clientId: string,
  submissionId: string,
): string {
  return (
    `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}` +
    `/clients/${encodeURIComponent(clientId)}` +
    `/forms/${encodeURIComponent(submissionId)}` +
    "/practitioner-signature"
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(activeIntlLocale(), {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}
