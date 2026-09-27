"use client";
import { useT } from "../i18n";

const LEVELS = [
  { label: "Minimum 8 znaków", bar: "bg-stone-200", text: "text-stone-500" },
  { label: "Słabe", bar: "bg-red-400", text: "text-red-700" },
  { label: "Średnie", bar: "bg-amber-400", text: "text-amber-700" },
  { label: "Dobre", bar: "bg-lime-500", text: "text-lime-700" },
  { label: "Silne", bar: "bg-emerald-500", text: "text-emerald-700" },
] as const;

function passwordLevel(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length < 8) return 1;
  if (score <= 1) return 1;
  if (score === 2) return 2;
  if (score === 3) return 3;
  return 4;
}

export function PasswordStrength({ password }: { readonly password: string }) {
  const t = useT();
  const level = passwordLevel(password);
  const style = LEVELS[level];
  return (
    <div
      className="mt-3 text-xs font-black uppercase tracking-[0.14em]"
      aria-live="polite"
    >
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((bar) => (
          <span
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              bar <= level ? style.bar : "bg-stone-200"
            }`}
            key={bar}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs">
        <span className={style.text}>{t("Siła hasła:")}{" "}{t(style.label)}</span>
        <span className="text-stone-500">{t("Użyj cyfr, wielkich liter i znaku specjalnego")}</span>
      </div>
    </div>
  );
}
