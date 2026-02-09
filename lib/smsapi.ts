/**
 * SMSAPI Integration for OTP Verification
 * Documentation: https://www.smsapi.pl/docs
 *
 * Required env vars:
 * - SMSAPI_TOKEN: OAuth token from SMSAPI panel
 * - SMSAPI_SENDER: Sender name (max 11 chars, registered in SMSAPI)
 */

const SMSAPI_BASE_URL = "https://api.smsapi.pl";

interface SMSAPIResponse {
  count: number;
  list: Array<{
    id: string;
    points: number;
    number: string;
    date_sent: number;
    submitted_number: string;
    status: string;
  }>;
}

interface SMSAPIError {
  error: number;
  message: string;
}

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Wysyła SMS przez SMSAPI
 */
export async function sendSMS(
  phoneNumber: string,
  message: string
): Promise<SendSMSResult> {
  const token = process.env.SMSAPI_TOKEN;
  const sender = process.env.SMSAPI_SENDER || "PowderBrows";

  if (!token) {
    console.error("SMSAPI_TOKEN is not configured");
    return {
      success: false,
      error: "SMS service not configured",
    };
  }

  // Normalizuj numer telefonu do formatu +48XXXXXXXXX
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  if (!normalizedPhone) {
    return {
      success: false,
      error: "Invalid phone number format",
    };
  }

  try {
    const params = new URLSearchParams({
      to: normalizedPhone,
      message: message,
      from: sender,
      format: "json",
      encoding: "utf-8",
    });

    const response = await fetch(`${SMSAPI_BASE_URL}/sms.do`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok || (data as SMSAPIError).error) {
      const errorData = data as SMSAPIError;
      console.error("SMSAPI error:", errorData);
      return {
        success: false,
        error: errorData.message || "Failed to send SMS",
      };
    }

    const successData = data as SMSAPIResponse;

    if (successData.count > 0 && successData.list[0]) {
      return {
        success: true,
        messageId: successData.list[0].id,
      };
    }

    return {
      success: false,
      error: "No SMS sent",
    };
  } catch (error) {
    console.error("SMSAPI request failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generuje losowy 6-cyfrowy kod OTP
 */
export function generateOTPCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Normalizuje numer telefonu do formatu międzynarodowego
 */
export function normalizePhoneNumber(phone: string): string | null {
  // Usuń wszystkie znaki oprócz cyfr i +
  const cleaned = phone.replace(/[^\d+]/g, "");

  // Sprawdź różne formaty
  if (cleaned.startsWith("+48") && cleaned.length === 12) {
    return cleaned;
  }

  if (cleaned.startsWith("48") && cleaned.length === 11) {
    return `+${cleaned}`;
  }

  if (cleaned.length === 9 && /^[4-9]/.test(cleaned)) {
    // Polski numer bez kierunkowego
    return `+48${cleaned}`;
  }

  return null;
}

/**
 * Tworzy wiadomość SMS z kodem OTP
 */
export function createOTPMessage(code: string): string {
  return `PowderBrows twój kod to: ${code}`;
}

/**
 * Maskuje numer telefonu dla wyświetlenia (np. +48 *** *** 789)
 */
export function maskPhoneNumber(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return phone;

  return `${normalized.slice(0, 3)} *** *** ${normalized.slice(-3)}`;
}
