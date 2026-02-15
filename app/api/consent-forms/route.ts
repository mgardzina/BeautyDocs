import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { auth } from "../../../lib/auth";

// POST - zapisz nowy formularz (publiczny)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Znajdź lub utwórz klientkę po imieniu i nazwisku
    const client = await prisma.client.upsert({
      where: { imieNazwisko: body.imieNazwisko },
      update: {
        telefon: body.telefon, // Aktualizuj telefon przy każdej wizycie
      },
      create: {
        imieNazwisko: body.imieNazwisko,
        telefon: body.telefon,
      },
    });

    const consentForm = await prisma.consentForm.create({
      data: {
        type: body.type || 'HYALURONIC', // Domyślnie Kwas, jeśli brak
        imieNazwisko: body.imieNazwisko,
        email: body.email || null,
        ulica: body.ulica || null,
        kodPocztowy: body.kodPocztowy || null,
        miasto: body.miasto || null,
        dataUrodzenia: body.dataUrodzenia || null,
        telefon: body.telefon,
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
        clientId: client.id, // Powiązanie z klientką
        // Digital Signature & Audit Log (Art. 78¹ KC - Forma Dokumentowa)
        signatureStatus: body.signatureStatus || 'PENDING',
        signatureVerifiedAt: body.auditLog?.signedAt ? new Date(body.auditLog.signedAt) : null,
        auditLog: body.auditLog || null,
      },
    });

    return NextResponse.json({
      success: true,
      id: consentForm.id,
    });
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
        type: true, // Zwróć typ
        createdAt: true,
        imieNazwisko: true,
        telefon: true,
        miejscowoscData: true,
        zgodaPrzetwarzanieDanych: true,
        zgodaMarketing: true,
        zgodaFotografie: true,
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
