import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateConsentFormPdf } from "@/lib/pdfGenerator";

/**
 * GET /api/consent-forms/[id]/pdf
 * Generuje i zwraca PDF karty zgody dla wskazanego formularza.
 * Dostęp tylko dla zalogowanych adminów.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Pobierz formularz z bazy (pełne dane)
    const form = await prisma.consentForm.findUnique({
      where: { id },
    });

    if (!form) {
      return NextResponse.json(
        { success: false, error: "Formularz nie znaleziony" },
        { status: 404 }
      );
    }

    // Generuj PDF
    const pdfBuffer = await generateConsentFormPdf({
      id: form.id,
      type: form.type,
      createdAt: form.createdAt.toISOString(),
      imieNazwisko: form.imieNazwisko,
      email: form.email,
      ulica: form.ulica,
      kodPocztowy: form.kodPocztowy,
      miasto: form.miasto,
      dataUrodzenia: form.dataUrodzenia,
      telefon: form.telefon,
      miejscowoscData: form.miejscowoscData,
      nazwaProduktu: form.nazwaProduktu,
      obszarZabiegu: form.obszarZabiegu,
      celEfektu: form.celEfektu,
      przeciwwskazania: (form.przeciwwskazania as Record<string, string | boolean | null>) || {},
      zgodaPrzetwarzanieDanych: form.zgodaPrzetwarzanieDanych,
      zgodaMarketing: form.zgodaMarketing,
      zgodaFotografie: form.zgodaFotografie,
      zgodaPomocPrawna: form.zgodaPomocPrawna,
      miejscaPublikacjiFotografii: form.miejscaPublikacjiFotografii,
      podpisDane: form.podpisDane,
      podpisMarketing: form.podpisMarketing,
      podpisFotografie: form.podpisFotografie,
      podpisRodo: form.podpisRodo,
      podpisRodo2: form.podpisRodo2,
      informacjaDodatkowa: form.informacjaDodatkowa,
      zastrzeniaKlienta: form.zastrzeniaKlienta,
      numerZabiegu: form.numerZabiegu,
      osobaPrzeprowadzajacaZabieg: form.osobaPrzeprowadzajacaZabieg,
      planowanaIloscZabiegow: form.planowanaIloscZabiegow,
      odstepMiedzyZabiegami: form.odstepMiedzyZabiegami,
      kolejneZabiegiOdstepy: form.kolejneZabiegiOdstepy,
      iloscProduktu: form.iloscProduktu,
      signatureStatus: form.signatureStatus,
      signatureVerifiedAt: form.signatureVerifiedAt?.toISOString() ?? null,
    });

    // Bezpieczna nazwa pliku
    const safeName = form.imieNazwisko.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s]/g, "").replace(/\s+/g, "_");
    const date = new Date(form.createdAt).toLocaleDateString("pl-PL").replace(/\./g, "-");
    const filename = `Karta_zgody_${safeName}_${date}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": pdfBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Błąd generowania PDF:", error);
    return NextResponse.json(
      { success: false, error: "Błąd generowania PDF", details: String(error) },
      { status: 500 }
    );
  }
}
