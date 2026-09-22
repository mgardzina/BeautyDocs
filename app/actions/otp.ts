"use server";

import { headers } from "next/headers";
import { createHash } from "crypto";
import { legacyDatabase } from "@/lib/legacy-database";
import {
  sendSMS,
  generateOTPCode,
  createOTPMessage,
  normalizePhoneNumber,
  maskPhoneNumber,
} from "@/lib/smsapi";

// Czas ważności kodu OTP (5 minut)
const OTP_EXPIRY_MINUTES = 5;
// Maksymalna liczba prób weryfikacji
const MAX_VERIFICATION_ATTEMPTS = 3;
// Cooldown między wysłaniem SMS (60 sekund)
const SMS_COOLDOWN_SECONDS = 60;

export interface SendOTPResult {
  success: boolean;
  maskedPhone?: string;
  error?: string;
  cooldownSeconds?: number;
}

export interface VerifyOTPResult {
  success: boolean;
  error?: string;
  attemptsLeft?: number;
  auditLog?: AuditLogData;
}

export interface AuditLogData {
  signedAt: string;
  ipAddress: string;
  userAgent: string;
  verificationMethod: "SMS_OTP";
  provider: "SMSAPI";
  phoneNumber: string;
  smsMessageId: string;
  documentHash: string;
  legalDisclaimersAccepted: boolean;
}

/**
 * Wysyła kod OTP na podany numer telefonu
 */
// Tryb testowy musi być włączony jawnie i nigdy nie może działać na produkcji.
const isTestMode = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.USE_TEST_OTP === "true";

/**
 * Wysyła kod OTP na podany numer telefonu
 */
export async function sendOTP(phoneNumber: string): Promise<SendOTPResult> {
  try {
    const normalized = normalizePhoneNumber(phoneNumber);

    if (!normalized) {
      return {
        success: false,
        error: "Nieprawidłowy format numeru telefonu. Użyj formatu +48 XXX XXX XXX",
      };
    }

    // 1. Check for Test Mode FIRST to avoid DB calls if not needed or if DB is down
    if (isTestMode()) {
      console.log(`[TEST MODE] Skipping DB cooldown check for ${normalized}`);
      const code = "123456";
      console.log(`[TEST MODE] OTP dla ${normalized}: ${code}`);
      
      // We don't save to DB in test mode to avoid connection errors if DB is unreachable
      return {
        success: true,
        maskedPhone: maskPhoneNumber(normalized),
        // We can pass the code back if we wanted to be stateless, 
        // but verifyOTP will just check for "123456" in test mode.
      };
    }

    // Sprawdź cooldown - czy nie wysłano już SMS w ostatnich 60 sekundach
    const recentOtp = await legacyDatabase.otpVerification.findFirst({
      where: {
        phoneNumber: normalized,
        createdAt: {
          gte: new Date(Date.now() - SMS_COOLDOWN_SECONDS * 1000),
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentOtp) {
      const secondsLeft = Math.ceil(
        (recentOtp.createdAt.getTime() + SMS_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000
      );
      return {
        success: false,
        error: `Poczekaj ${secondsLeft} sekund przed wysłaniem kolejnego kodu`,
        cooldownSeconds: secondsLeft,
      };
    }

    // Generuj kod OTP
    const code = generateOTPCode();
    const message = createOTPMessage(code);

    // Wyślij SMS przez SMSAPI
    const smsResult = await sendSMS(normalized, message);

    if (!smsResult.success) {
      console.error("Failed to send OTP SMS:", smsResult.error);
      return {
        success: false,
        error: "Nie udało się wysłać SMS. Spróbuj ponownie za chwilę.",
      };
    }

    // Zapisz OTP w bazie danych
    await legacyDatabase.otpVerification.create({
      data: {
        phoneNumber: normalized,
        code: code,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
        verified: false,
        attempts: 0,
      },
    });

    // Zapisz messageId dla audit log (tymczasowo w pamięci sesji lub cache)
    globalThis.__smsMessageIds = globalThis.__smsMessageIds || {};
    globalThis.__smsMessageIds[normalized] = smsResult.messageId;

    return {
      success: true,
      maskedPhone: maskPhoneNumber(normalized),
    };
  } catch (error) {
    console.error("sendOTP error:", error);
    // Fallback to test mode if DB fails but we are in a permissive environment? 
    // For now, let's keep it strict unless isTestMode() captured it.
    if (isTestMode()) {
       return { success: true, maskedPhone: maskPhoneNumber(phoneNumber) };
    }
    return {
      success: false,
      error: "Wystąpił błąd podczas wysyłania kodu. Spróbuj ponownie.",
    };
  }
}

/**
 * Weryfikuje kod OTP i generuje audit log
 */
export async function verifyOTP(
  phoneNumber: string,
  code: string,
  documentContent: string,
  legalDisclaimersAccepted: boolean
): Promise<VerifyOTPResult> {
  try {
    const normalized = normalizePhoneNumber(phoneNumber);

    if (!normalized) {
      return {
        success: false,
        error: "Nieprawidłowy numer telefonu",
      };
    }

    // 1. Bypass Verification for Test Code in Test Mode
    if (isTestMode() && code === "123456") {
       console.log(`[TEST MODE] Bypassing verification for ${normalized}`);
       
       // Mimic success response without DB access
       const headersList = await headers();
       const ipAddress =
        headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headersList.get("x-real-ip") ||
        "unknown";
       const userAgent = headersList.get("user-agent") || "unknown";
       
       const documentHash = createHash("sha256")
        .update(documentContent, "utf8")
        .digest("hex");

       const auditLog: AuditLogData = {
        signedAt: new Date().toISOString(),
        ipAddress,
        userAgent,
        verificationMethod: "SMS_OTP",
        provider: "SMSAPI",
        phoneNumber: normalized,
        smsMessageId: "test-message-id",
        documentHash,
        legalDisclaimersAccepted,
       };

       return {
         success: true,
         auditLog,
       };
    }

    // Znajdź aktywny kod OTP
    const otpRecord = await legacyDatabase.otpVerification.findFirst({
      where: {
        phoneNumber: normalized,
        verified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return {
        success: false,
        error: "Kod wygasł lub nie istnieje. Wyślij nowy kod.",
      };
    }

    // Sprawdź liczbę prób
    if (otpRecord.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      // Oznacz jako zużyty
      await legacyDatabase.otpVerification.update({
        where: { id: otpRecord.id },
        data: { verified: true }, // Blokujemy dalsze próby
      });

      return {
        success: false,
        error: "Przekroczono limit prób. Wyślij nowy kod.",
        attemptsLeft: 0,
      };
    }

    // Sprawdź kod
    if (otpRecord.code !== code) {
      // Zwiększ licznik prób
      await legacyDatabase.otpVerification.update({
        where: { id: otpRecord.id },
        data: { attempts: otpRecord.attempts + 1 },
      });

      const attemptsLeft = MAX_VERIFICATION_ATTEMPTS - otpRecord.attempts - 1;

      return {
        success: false,
        error: `Nieprawidłowy kod. Pozostało prób: ${attemptsLeft}`,
        attemptsLeft,
      };
    }

    // Kod poprawny - oznacz jako zweryfikowany
    await legacyDatabase.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    // Pobierz dane do audit log
    const headersList = await headers();
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    // Generuj hash dokumentu (SHA-256)
    const documentHash = createHash("sha256")
      .update(documentContent, "utf8")
      .digest("hex");

    // Pobierz messageId z cache
    const smsMessageId =
      (globalThis.__smsMessageIds && globalThis.__smsMessageIds[normalized]) ||
      "not-available";

    // Stwórz audit log
    const auditLog: AuditLogData = {
      signedAt: new Date().toISOString(),
      ipAddress,
      userAgent,
      verificationMethod: "SMS_OTP",
      provider: "SMSAPI",
      phoneNumber: normalized,
      smsMessageId,
      documentHash,
      legalDisclaimersAccepted,
    };

    // Wyczyść cache messageId
    if (globalThis.__smsMessageIds) {
      delete globalThis.__smsMessageIds[normalized];
    }

    return {
      success: true,
      auditLog,
    };
  } catch (error) {
    console.error("verifyOTP error:", error);
    return {
      success: false,
      error: "Wystąpił błąd podczas weryfikacji. Spróbuj ponownie.",
    };
  }
}

/**
 * Generuje hash SHA-256 zawartości dokumentu
 */
export async function generateDocumentHash(content: string): Promise<string> {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

// Deklaracja typu dla globalnego cache messageId
declare global {
  var __smsMessageIds: Record<string, string | undefined> | undefined;
}
