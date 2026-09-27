"use client";

import { useT } from "../i18n";
import { useRef, type ClipboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * 6-digit verification code, auto-advancing between boxes. Controlled.
 * Shared between the salon-owner and client auth flows so both e-mail
 * verification screens look and behave identically.
 */
export function BeautyDocsCodeInput({
  value,
  onChange,
  disabled = false,
}: {
  readonly value: string;
  readonly onChange: (code: string) => void;
  readonly disabled?: boolean;
}) {
  const t = useT();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");
  const reduceMotion = useReducedMotion();

  const setDigit = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, "").slice(-1);
    const next = value.padEnd(6, " ").slice(0, 6).split("");
    next[index] = clean || " ";
    onChange(next.join("").replace(/ /g, ""));
    if (clean && index < 5) refs.current[index + 1]?.focus();
  };

  const onKeyDown = (index: number, key: string) => {
    if (key === "Backspace" && (digits[index] ?? " ").trim() === "" && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex justify-between gap-2" onPaste={onPaste}>
      {digits.map((digit, i) => (
        <motion.input
          aria-label={t("Cyfra {value1}", { value1: i + 1 })}
          className="size-12 rounded-xl border border-[#d4decc] bg-white text-center text-xl font-bold text-[#173d35] outline-none transition-colors focus:border-[#245c4d] focus:ring-4 focus:ring-[#245c4d]/10 disabled:opacity-60 sm:size-14"
          disabled={disabled}
          inputMode="numeric"
          key={i}
          maxLength={1}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e.key)}
          ref={(el) => {
            refs.current[i] = el;
          }}
          transition={{ type: "spring", bounce: 0, duration: 0.2 }}
          value={digit.trim()}
          whileFocus={reduceMotion || disabled ? undefined : { scale: 1.06 }}
          whileTap={reduceMotion || disabled ? undefined : { scale: 0.95 }}
        />
      ))}
    </div>
  );
}
