"use client";

import { useT } from "../i18n";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatPolishNipInput } from "../../../lib/polish-nip";

export interface CompanyConfigurationForm {
  readonly nip: string;
  readonly regon: string;
  readonly krs: string;
  readonly companyName: string;
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
}

export const EMPTY_COMPANY_CONFIGURATION: CompanyConfigurationForm = {
  nip: "",
  regon: "",
  krs: "",
  companyName: "",
  street: "",
  postalCode: "",
  city: "",
};

const CONTROL_HEIGHT = "h-11 rounded-xl";

/**
 * Company / GUS details, shared by the e-mail finalize card and the Google
 * configure step. Controlled by the parent so both flows drive one lookup.
 */
export function BeautyDocsCompanyFields({
  company,
  onChange,
  onLookup,
  lookupPending,
  lookupNote,
  disabled,
}: {
  readonly company: CompanyConfigurationForm;
  readonly onChange: (field: keyof CompanyConfigurationForm, value: string) => void;
  readonly onLookup: () => void;
  readonly lookupPending: boolean;
  readonly lookupNote: string | null;
  readonly disabled: boolean;
}) {
  const t = useT();
  const busy = disabled || lookupPending;
  return (
    <>
      <Field>
        <FieldLabel htmlFor="cfg-nip">{t("NIP")}</FieldLabel>
        <div className="flex gap-2">
          <Input
            autoComplete="off"
            className={cn(CONTROL_HEIGHT, "text-base")}
            disabled={busy}
            id="cfg-nip"
            inputMode="numeric"
            maxLength={13}
            name="nip"
            onChange={(event) =>
              onChange("nip", formatPolishNipInput(event.target.value))
            }
            placeholder="000-000-00-00"
            required
            value={company.nip}
          />
          <Button
            className={cn(CONTROL_HEIGHT, "shrink-0 px-4 font-semibold")}
            disabled={busy}
            onClick={onLookup}
            type="button"
            variant="outline"
          >
            {lookupPending ? t("Pobieranie…") : t("Pobierz z GUS")}
          </Button>
        </div>
      </Field>

      {lookupNote ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <Check aria-hidden="true" className="mr-2 inline size-4" />
          {t(lookupNote)}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="cfg-regon">
            {t("REGON")}
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {t("opcjonalnie")}
            </span>
          </FieldLabel>
          <Input
            className={cn(CONTROL_HEIGHT, "text-base")}
            disabled={busy}
            id="cfg-regon"
            inputMode="numeric"
            maxLength={14}
            name="regon"
            onChange={(event) =>
              onChange("regon", event.target.value.replace(/\D/g, "").slice(0, 14))
            }
            placeholder="9 lub 14 cyfr"
            value={company.regon}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cfg-krs">
            {t("KRS")}
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {t("jeśli dotyczy")}
            </span>
          </FieldLabel>
          <Input
            className={cn(CONTROL_HEIGHT, "text-base")}
            disabled={busy}
            id="cfg-krs"
            inputMode="numeric"
            maxLength={10}
            name="krs"
            onChange={(event) =>
              onChange("krs", event.target.value.replace(/\D/g, "").slice(0, 10))
            }
            placeholder="0000000000"
            value={company.krs}
          />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="cfg-company">{t("Nazwa firmy")}</FieldLabel>
        <Input
          autoComplete="organization"
          className={cn(CONTROL_HEIGHT, "text-base")}
          disabled={busy}
          id="cfg-company"
          name="companyName"
          onChange={(event) => onChange("companyName", event.target.value)}
          placeholder={t("np. Studio Lumière sp. z o.o.")}
          required
          value={company.companyName}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="cfg-street">{t("Ulica i numer")}</FieldLabel>
        <Input
          autoComplete="street-address"
          className={cn(CONTROL_HEIGHT, "text-base")}
          disabled={busy}
          id="cfg-street"
          name="street"
          onChange={(event) => onChange("street", event.target.value)}
          placeholder={t("np. ul. Kwiatowa 12/3")}
          required
          value={company.street}
        />
      </Field>

      <div className="grid grid-cols-[0.7fr_1fr] gap-3">
        <Field>
          <FieldLabel htmlFor="cfg-postal">{t("Kod pocztowy")}</FieldLabel>
          <Input
            autoComplete="postal-code"
            className={cn(CONTROL_HEIGHT, "text-base")}
            disabled={busy}
            id="cfg-postal"
            inputMode="numeric"
            maxLength={6}
            name="postalCode"
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").slice(0, 5);
              onChange(
                "postalCode",
                digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits,
              );
            }}
            pattern="\d{2}-\d{3}"
            placeholder="00-001"
            required
            value={company.postalCode}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cfg-city">{t("Miejscowość")}</FieldLabel>
          <Input
            autoComplete="address-level2"
            className={cn(CONTROL_HEIGHT, "text-base")}
            disabled={busy}
            id="cfg-city"
            name="city"
            onChange={(event) => onChange("city", event.target.value)}
            placeholder={t("np. Warszawa")}
            required
            value={company.city}
          />
        </Field>
      </div>

      <FieldDescription>
        {t("Danych firmowych użyjemy w formularzach i klauzulach informacyjnych.")}
      </FieldDescription>
    </>
  );
}
