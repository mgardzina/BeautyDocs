/**
 * Wysyłka emaila z kartą zgody jako załącznikiem PDF
 * Używa Resend (https://resend.com)
 *
 * Od: noreply@powderbrowsacademy.com.pl (lub sandbox jeśli domena niezweryfikowana)
 * Do: klient (jeśli podał email) + admins
 */
import { Resend } from "resend";

// Adres admina / salonu — zawsze dostaje kopię
const SALON_EMAIL = process.env.SALON_EMAIL || "kontakt@powderbrowsacademy.com.pl";
const SALON_NAME = "Powder Brows Academy";

// Adres nadawcy — musi być zweryfikowaną domeną w Resend
// Na start użyj onboarding@resend.dev jeśli domena nie jest zweryfikowana
const FROM_EMAIL = "formularz@powderbrowsacademy.com.pl";
const FROM_DISPLAY = `${SALON_NAME} <${FROM_EMAIL}>`;

interface SendConsentEmailOptions {
  formId: string;
  clientName: string;
  clientEmail?: string | null;
  formTypeLabel: string;
  formDate: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}

function getFormTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    LIP_AUGMENTATION: "Modelowanie ust",
    FACIAL_VOLUMETRY: "Wolumetria twarzy",
    WRINKLE_REDUCTION: "Niwelowanie zmarszczek",
    NEEDLE_MESOTHERAPY: "Mezoterapia igłowa",
    INJECTION_LIPOLYSIS: "Lipoliza iniekcyjna",
    TISSUE_STIMULATION: "Stymulacja tkankowa",
    PERMANENT_MAKEUP: "Makijaż permanentny",
    LASER_HAIR_REMOVAL: "Depilacja laserowa",
    LASER_TATTOO_REMOVAL: "Laserowe usuwanie",
    EYEBROW_TINTING: "Henna brwi",
    EYEBROW_LAMINATION: "Laminacja brwi",
    EYELASH_EXTENSION: "Przedłużanie rzęs",
    EYELID_LIFT: "Lifting powiek",
    HYALURONIC: "Kwas hialuronowy",
    PMU: "Makijaż permanentny",
    LASER: "Laser",
  };
  return labels[type] || type;
}

// ─── Email do klienta ─────────────────────────────────────────────────────
function clientEmailHtml(clientName: string, formType: string, formDate: string): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Potwierdzenie karty zgody</title>
</head>
<body style="margin:0; padding:0; background-color:#1a1a1a; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#2a2a2a; border-radius:12px; overflow:hidden; border:1px solid #C9A84C;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a1a 0%,#2d2200 100%); padding:32px 40px; border-bottom:2px solid #C9A84C; text-align:center;">
              <h1 style="margin:0; color:#C9A84C; font-size:22px; font-weight:300; letter-spacing:2px; text-transform:uppercase;">
                ${SALON_NAME}
              </h1>
              <p style="margin:6px 0 0; color:#888; font-size:13px;">Dokumentacja Zabiegowa</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h2 style="color:#f5f5f5; font-size:18px; font-weight:400; margin:0 0 16px;">
                Droga/i ${clientName},
              </h2>
              <p style="color:#ccc; line-height:1.7; margin:0 0 16px;">
                Dziękujemy za wypełnienie karty zgody na zabieg
                <strong style="color:#C9A84C;">${formType}</strong>
                w dniu <strong>${formDate}</strong>.
              </p>
              <p style="color:#ccc; line-height:1.7; margin:0 0 24px;">
                W załączniku znajdziesz podpisaną kartę zgody w formacie PDF —
                zachowaj ją dla własnych celów. Dokument ten potwierdza Twoją
                świadomą zgodę na przeprowadzenie zabiegu oraz zawiera wszystkie
                istotne informacje dotyczące zabiegu.
              </p>
              <!-- Divider -->
              <hr style="border:none; border-top:1px solid #444; margin:24px 0;">
              <p style="color:#888; font-size:12px; line-height:1.6; margin:0 0 8px;">
                📎 W załączniku: <strong style="color:#C9A84C;">Karta zgody (PDF)</strong>
              </p>
              <p style="color:#888; font-size:12px; line-height:1.6; margin:0;">
                Jeśli masz jakiekolwiek pytania, skontaktuj się z nami bezpośrednio.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#1a1a1a; padding:20px 40px; border-top:1px solid #333; text-align:center;">
              <p style="color:#555; font-size:11px; margin:0;">
                ${SALON_NAME} • Dokument wygenerowany automatycznie
              </p>
              <p style="color:#555; font-size:11px; margin:4px 0 0;">
                Nie odpowiadaj na tę wiadomość.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// ─── Email do admina ──────────────────────────────────────────────────────
function adminEmailHtml(
  clientName: string,
  formType: string,
  formDate: string,
  formId: string
): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Nowa karta zgody</title>
</head>
<body style="margin:0; padding:0; background:#0d0d0d; font-family:Helvetica, Arial, sans-serif; color:#eee;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1a1a; border:1px solid #C9A84C; border-radius:10px; overflow:hidden;">
          <tr>
            <td style="padding:20px 30px; border-bottom:2px solid #C9A84C; background:#111;">
              <h2 style="margin:0; color:#C9A84C; font-size:16px; text-transform:uppercase; letter-spacing:1px;">
                📋 Nowa Karta Zgody
              </h2>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 30px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr><td style="color:#888;font-size:12px;padding-bottom:4px;">Klient:</td>
                    <td style="color:#fff;font-size:14px;font-weight:bold;padding-bottom:4px;">${clientName}</td></tr>
                <tr><td style="color:#888;font-size:12px;padding-bottom:4px;padding-top:8px;">Zabieg:</td>
                    <td style="color:#C9A84C;font-size:14px;padding-bottom:4px;padding-top:8px;">${formType}</td></tr>
                <tr><td style="color:#888;font-size:12px;padding-bottom:4px;padding-top:8px;">Data:</td>
                    <td style="color:#eee;font-size:13px;padding-bottom:4px;padding-top:8px;">${formDate}</td></tr>
                <tr><td style="color:#888;font-size:12px;padding-top:8px;">ID formularza:</td>
                    <td style="color:#555;font-size:11px;font-family:monospace;padding-top:8px;">${formId}</td></tr>
              </table>
              <div style="margin-top:20px; padding:12px; background:#0d0d0d; border:1px solid #333; border-radius:6px;">
                <p style="margin:0; color:#888; font-size:12px;">
                  📎 Karta zgody PDF dołączona w załączniku.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 30px; background:#0d0d0d; border-top:1px solid #222; text-align:center;">
              <p style="margin:0; color:#444; font-size:11px;">${SALON_NAME} — Panel Admina</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// ─── Główna funkcja wysyłki ───────────────────────────────────────────────
export async function sendConsentFormEmail(
  opts: SendConsentEmailOptions
): Promise<{ success: boolean; error?: string }> {
  const {
    formId,
    clientName,
    clientEmail,
    formTypeLabel,
    formDate,
    pdfBuffer,
    pdfFilename,
  } = opts;

  const pdfAttachment = {
    filename: pdfFilename,
    content: pdfBuffer.toString("base64"),
  };

  // Lazy initialization — Resend wymaga klucza tylko w runtime, nie podczas build
  const apiKey = process.env.SMTP_TOKEN;
  if (!apiKey) {
    console.error("[Resend] Brak SMTP_TOKEN w env — email nie zostanie wysłany");
    return { success: false, error: "Missing SMTP_TOKEN" };
  }
  const resend = new Resend(apiKey);

  try {
    // 1. Email do klienta (jeśli podał email)
    if (clientEmail) {
      const clientResult = await resend.emails.send({
        from: FROM_DISPLAY,
        to: [clientEmail],
        subject: `Twoja karta zgody — ${formTypeLabel} | ${SALON_NAME}`,
        html: clientEmailHtml(clientName, formTypeLabel, formDate),
        attachments: [pdfAttachment],
      });

      if (clientResult.error) {
        console.warn("[Resend] Błąd wysyłki do klienta:", clientResult.error);
      } else {
        console.log("[Resend] Email do klienta wysłany:", clientResult.data?.id);
      }
    }

    // 2. Kopia do admina / salonu (zawsze)
    const adminResult = await resend.emails.send({
      from: FROM_DISPLAY,
      to: [SALON_EMAIL],
      subject: `[Nowa karta zgody] ${clientName} — ${formTypeLabel}`,
      html: adminEmailHtml(clientName, formTypeLabel, formDate, formId),
      attachments: [pdfAttachment],
    });

    if (adminResult.error) {
      console.error("[Resend] Błąd wysyłki do admina:", adminResult.error);
      return { success: false, error: String(adminResult.error) };
    }

    console.log("[Resend] Email do admina wysłany:", adminResult.data?.id);
    return { success: true };
  } catch (error) {
    console.error("[Resend] Nieoczekiwany błąd:", error);
    return { success: false, error: String(error) };
  }
}

// Eksport helper do label
export { getFormTypeLabel };
