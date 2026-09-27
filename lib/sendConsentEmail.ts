/**
 * Wysyłka emaila z kartą zgody jako załącznikiem PDF
 * Używa Resend (https://resend.com)
 *
 * Od: noreply@beautydocs.pl (lub sandbox jeśli domena niezweryfikowana)
 * Do: klient (jeśli podał email) + admins
 */
import { Resend } from "resend";

// Adres admina / salonu — zawsze dostaje kopię
const SALON_EMAIL = process.env.SALON_EMAIL || "kontakt@beautydocs.pl";
const SALON_NAME = "BeautyDocs";

// Adres nadawcy — musi być zweryfikowaną domeną w Resend
// Na start użyj onboarding@resend.dev jeśli domena nie jest zweryfikowana
const FROM_EMAIL = process.env.FROM_EMAIL || "formularz@beautydocs.pl";
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
    FACIAL_CLEANSING: "Oczyszczanie twarzy",
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
<body style="margin:0; padding:0; background-color:#FAF8F5; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color:#4A4038;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF; border-radius:12px; overflow:hidden; border:1px solid #D4AF37; box-shadow: 0 4px 25px rgba(0, 0, 0, 0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(45deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C); padding:32px 40px; text-align:center;">
              <h1 style="margin:0; color:#2D2520; font-size:24px; font-weight:600; letter-spacing:2px; text-transform:uppercase;">
                ${SALON_NAME}
              </h1>
              <p style="margin:6px 0 0; color:#4A4038; font-size:13px; font-weight:500;">Dokumentacja Zabiegowa</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h2 style="color:#2D2520; font-size:20px; font-weight:500; margin:0 0 16px;">
                Droga/i ${clientName},
              </h2>
              <p style="color:#5A4F44; line-height:1.7; margin:0 0 16px;">
                Dziękujemy za wypełnienie karty zgody na zabieg
                <strong style="color:#B5952F;">${formType}</strong>
                w dniu <strong>${formDate}</strong>.
              </p>
              <p style="color:#5A4F44; line-height:1.7; margin:0 0 24px;">
                W załączniku znajduje się Twoja podpisana karta zgody w formacie PDF. 
                Zachowaj ją dla własnych celów. Dokument ten potwierdza Twoją
                świadomą zgodę na przeprowadzenie zabiegu oraz zawiera wszystkie
                istotne informacje dotyczące procedury i zaleceń pozabiegowych.
              </p>
              <!-- Divider -->
              <hr style="border:none; border-top:1px solid #D1C9BF; margin:24px 0;">
              
              <div style="background:#F2EDE7; padding:16px; border-radius:8px; border-left:4px solid #D4AF37;">
                <p style="color:#4A4038; font-size:13px; line-height:1.6; margin:0;">
                  Otwórz załącznik: <strong style="color:#B5952F;">Karta_zgody_${clientName.replace(/\s+/g, "_")}.pdf</strong>
                </p>
              </div>

              <p style="color:#7A6E62; font-size:13px; line-height:1.6; margin:24px 0 0;">
                W razie jakichkolwiek pytań lub wątpliwości przed zabiegiem, skontaktuj się z nami.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#FAF8F5; padding:20px 40px; border-top:1px solid #D1C9BF; text-align:center;">
              <p style="color:#7A6E62; font-size:11px; margin:0;">
                ${SALON_NAME} • Wiadomość wygenerowana automatycznie
              </p>
              <p style="color:#7A6E62; font-size:11px; margin:4px 0 0;">
                Prosimy nie odpowiadać na ten adres email.
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
<body style="margin:0; padding:0; background-color:#FAF8F5; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color:#4A4038;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF; border-radius:12px; overflow:hidden; border:1px solid #D4AF37; box-shadow: 0 4px 25px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="padding:24px 30px; border-bottom:1px solid #D1C9BF; background:#FAF8F5;">
              <h2 style="margin:0; color:#2D2520; font-size:16px; text-transform:uppercase; letter-spacing:1px; display:flex; align-items:center;">
                <span style="color:#D4AF37; margin-right:8px;">📋</span> Nowa Karta Zgody
              </h2>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 30px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color:#7A6E62; font-size:12px; padding-bottom:6px; width:40%;">Klient:</td>
                  <td style="color:#2D2520; font-size:14px; font-weight:600; padding-bottom:6px;">${clientName}</td>
                </tr>
                <tr>
                  <td style="color:#7A6E62; font-size:12px; padding-bottom:6px; padding-top:8px; border-top:1px solid #F2EDE7;">Zabieg:</td>
                  <td style="color:#D4AF37; font-size:14px; font-weight:500; padding-bottom:6px; padding-top:8px; border-top:1px solid #F2EDE7;">${formType}</td>
                </tr>
                <tr>
                  <td style="color:#7A6E62; font-size:12px; padding-bottom:6px; padding-top:8px; border-top:1px solid #F2EDE7;">Data zgody:</td>
                  <td style="color:#4A4038; font-size:13px; padding-bottom:6px; padding-top:8px; border-top:1px solid #F2EDE7;">${formDate}</td>
                </tr>
                <tr>
                  <td style="color:#7A6E62; font-size:12px; padding-top:8px; border-top:1px solid #F2EDE7;">ID formularza:</td>
                  <td style="color:#7A6E62; font-size:11px; font-family:monospace; padding-top:8px; border-top:1px solid #F2EDE7;">${formId}</td>
                </tr>
              </table>
              <div style="margin-top:28px; padding:16px; background:#F2EDE7; border-left:4px solid #D4AF37; border-radius:0 8px 8px 0;">
                <p style="margin:0; color:#4A4038; font-size:13px; line-height:1.6;">
                  Szczegóły wywiadu medycznego oraz podpis klienta znajdziesz w załączonym dokumencie PDF.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 30px; background:#FAF8F5; border-top:1px solid #D1C9BF; text-align:center;">
              <p style="margin:0; color:#7A6E62; font-size:11px;">Administracja Systemu • ${SALON_NAME}</p>
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
