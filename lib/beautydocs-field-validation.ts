import type { FormField } from "../types/tenant";

/** Field errors are keyed so the form can explain and focus every correction. */
export function validateBeautyDocsFields(
  fields: readonly FormField[],
  values: Readonly<Record<string, string>>,
  treatmentArea: readonly string[],
  hasAreaMap: boolean,
  today = new Date(),
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.type === "consent" || field.type === "signature") continue;
    const value = values[field.key]?.trim() ?? "";
    if (field.key === "obszarZabiegu" && hasAreaMap) {
      if (field.required && !treatmentArea.length) errors[field.key] = "Zaznacz obszar zabiegu na mapie.";
      continue;
    }
    if (field.key === "dataUrodzenia") {
      if ((!value || value === "--") && !field.required) continue;
      const [year, month, day] = value.split("-").map(Number);
      const birth = new Date(year, month - 1, day);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || year < 1900 || birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day || birth > today) {
        errors[field.key] = "Podaj prawidłową, pełną datę urodzenia (dzień, miesiąc, rok).";
      } else {
        const birthdayPassed = today.getMonth() > month - 1 || (today.getMonth() === month - 1 && today.getDate() >= day);
        if (today.getFullYear() - year - (birthdayPassed ? 0 : 1) < 18) errors[field.key] = "Musisz mieć ukończone 18 lat, aby wypełnić formularz.";
      }
      continue;
    }
    if (!value && field.required) {
      errors[field.key] = `Uzupełnij pole „${field.label}”.`;
    } else if (value && field.key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[field.key] = "Podaj prawidłowy adres e-mail, np. anna@example.com.";
    }
  }
  return errors;
}
