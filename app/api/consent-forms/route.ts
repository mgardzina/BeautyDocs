import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { auth } from "../../../lib/auth";
import { generateConsentFormPdf } from "@/lib/pdfGenerator";
import { sendConsentFormEmail, getFormTypeLabel } from "@/lib/sendConsentEmail";

function normalizeName(name: string | undefined | null): string {
  if (!name) return "";
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

// POST - zapisz nowy formularz (publiczny)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const formType = body.type || "HYALURONIC";

    // Normalizacja danych klienckich zapobiegająca duplikatom
    const normalizedName = normalizeName(body.imieNazwisko);
    const normalizedPhone = normalizePhone(body.telefon);

    // Znajdź lub utwórz klientkę po imieniu i nazwisku
    const client = await prisma.client.upsert({
      where: { imieNazwisko: normalizedName },
      update: {
        telefon: normalizedPhone,
      },
      create: {
        imieNazwisko: normalizedName,
        telefon: normalizedPhone,
      },
    });

    const consentForm = await prisma.consentForm.create({
      data: {
        type: formType,
        imieNazwisko: normalizedName,
        email: body.email || null,
        ulica: body.ulica || null,
        kodPocztowy: body.kodPocztowy || null,
        miasto: body.miasto || null,
        dataUrodzenia: body.dataUrodzenia || null,
        telefon: normalizedPhone,
        miejscowoscData: body.miejscowoscData,
        nazwaProduktu: body.nazwaProduktu || null,
        obszarZabiegu: body.obszarZabiegu || null,
        celEfektu: body.celEfektu || null,
        przeciwwskazania: body.przeciwwskazania,
        zgodaPrzetwarzanieDanych: Boolean(body.zgodaPrzetwarzanieDanych),
        zgodaMarketing: Boolean(body.zgodaMarketing),
        zgodaFotografie: Boolean(body.zgodaFotografie),
        zgodaPomocPrawna: Boolean(body.zgodaPomocPrawna),
        miejscaPublikacjiFotografii: body.miejscaPublikacjiFotografii || null,
        podpisDane: body.podpisDane || null,
        podpisMarketing: body.podpisMarketing || null,
        podpisFotografie: body.podpisFotografie || null,
        podpisRodo: body.podpisRodo || null,
        podpisRodo2: body.podpisRodo2 || null,
        informacjaDodatkowa: body.informacjaDodatkowa || null,
        zastrzeniaKlienta: body.zastrzeniaKlienta || null,
        numerZabiegu: body.numerZabiegu || null,
        osobaPrzeprowadzajacaZabieg: body.osobaPrzeprowadzajacaZabieg || null,
        // Seria zabiegowa
        planowanaIloscZabiegow: body.planowanaIloscZabiegow || null,
        odstepMiedzyZabiegami: body.odstepMiedzyZabiegami || null,
        kolejneZabiegiOdstepy: body.kolejneZabiegiOdstepy || null,
        iloscProduktu: body.iloscProduktu || null,
        clientId: client.id,
        // Digital Signature & Audit Log (Art. 78¹ KC - Forma Dokumentowa)
        signatureStatus: body.signatureStatus || "PENDING",
        signatureVerifiedAt: body.auditLog?.signedAt ? new Date(body.auditLog.signedAt) : null,
        auditLog: body.auditLog || null,
      },
    });

    // Odpowiedz natychmiast — PDF/email wysyłamy asynchronicznie w tle
    const responseData = { success: true, id: consentForm.id };

    // Generuj PDF i wyślij email w tle (nie blokuje odpowiedzi dla klienta)
    (async () => {
      try {
        const pdfBuffer = await generateConsentFormPdf({
          id: consentForm.id,
          type: formType,
          createdAt: consentForm.createdAt.toISOString(),
          imieNazwisko: normalizedName,
          email: body.email || null,
          ulica: body.ulica || null,
          kodPocztowy: body.kodPocztowy || null,
          miasto: body.miasto || null,
          dataUrodzenia: body.dataUrodzenia || null,
          telefon: normalizedPhone,
          miejscowoscData: body.miejscowoscData,
          nazwaProduktu: body.nazwaProduktu || null,
          obszarZabiegu: body.obszarZabiegu || null,
          celEfektu: body.celEfektu || null,
          przeciwwskazania: body.przeciwwskazania || {},
          zgodaPrzetwarzanieDanych: Boolean(body.zgodaPrzetwarzanieDanych),
          zgodaMarketing: Boolean(body.zgodaMarketing),
          zgodaFotografie: Boolean(body.zgodaFotografie),
          zgodaPomocPrawna: Boolean(body.zgodaPomocPrawna),
          miejscaPublikacjiFotografii: body.miejscaPublikacjiFotografii || null,
          podpisDane: body.podpisDane || null,
          podpisMarketing: body.podpisMarketing || null,
          podpisFotografie: body.podpisFotografie || null,
          podpisRodo: body.podpisRodo || null,
          podpisRodo2: body.podpisRodo2 || null,
          informacjaDodatkowa: body.informacjaDodatkowa || null,
          zastrzeniaKlienta: body.zastrzeniaKlienta || null,
          numerZabiegu: body.numerZabiegu || null,
          osobaPrzeprowadzajacaZabieg: body.osobaPrzeprowadzajacaZabieg || null,
          planowanaIloscZabiegow: body.planowanaIloscZabiegow || null,
          odstepMiedzyZabiegami: body.odstepMiedzyZabiegami || null,
          kolejneZabiegiOdstepy: body.kolejneZabiegiOdstepy || null,
          iloscProduktu: body.iloscProduktu || null,
          signatureStatus: body.signatureStatus || "PENDING",
          signatureVerifiedAt: body.auditLog?.signedAt || null,
        });

        const formTypeLabel = getFormTypeLabel(formType);
        const safeName = normalizedName
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .replace(/\s+/g, "_");
        const date = new Date(consentForm.createdAt)
          .toLocaleDateString("pl-PL")
          .replace(/\./g, "-");
        const pdfFilename = `Karta_zgody_${safeName}_${date}.pdf`;

        await sendConsentFormEmail({
          formId: consentForm.id,
          clientName: normalizedName,
          clientEmail: body.email || null,
          formTypeLabel,
          formDate: body.miejscowoscData,
          pdfBuffer,
          pdfFilename,
        });

        console.log(
          `[PDF] Wygenerowano i wysłano email dla formularza ${consentForm.id}`
        );
      } catch (emailError) {
        // Błąd emaila NIE powinien psować odpowiedzi — logujemy tylko
        console.error(
          "[PDF/Email] Błąd podczas generowania/wysyłki:",
          emailError
        );
      }
    })();

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Błąd zapisu formularza:", error);
    return NextResponse.json(
      { success: false, error: "Błąd zapisu formularza", details: String(error) },
      { status: 500 }
    );
  }
}

// GET - pobierz listę formularzy (tylko dla zalogowanych)
export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const forms = await prisma.consentForm.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        createdAt: true,
        imieNazwisko: true,
        telefon: true,
        miejscowoscData: true,
        zgodaPrzetwarzanieDanych: true,
        zgodaMarketing: true,
        zgodaFotografie: true,
        podpisRodo: true,
        podpisRodo2: true,
        podpisMarketing: true,
        podpisFotografie: true,
        podpisDane: true,
      },
    });

    return NextResponse.json({ success: true, forms });
  } catch (error) {
    console.error("Błąd pobierania formularzy:", error);
    return NextResponse.json(
      { success: false, error: "Błąd pobierania formularzy" },
      { status: 500 }
    );
  }
}
