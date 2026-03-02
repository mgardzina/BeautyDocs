import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateConsentFormPdf } from "@/lib/pdfGenerator";

export async function GET() {
  try {
    const form = await prisma.consentForm.findFirst({
      where: {
        obszarZabiegu: { not: undefined }
      },
      orderBy: { createdAt: 'desc' }
    });
    if (!form) return NextResponse.json({ error: "No form" });

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
      obszarZabiegu: form.obszarZabiegu as any,
      celEfektu: form.celEfektu,
      przeciwwskazania: (form.przeciwwskazania as any) || {},
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
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf" },
    });
  } catch (error: any) {
    return NextResponse.json({ error: String(error), stack: error.stack }, { status: 500 });
  }
}
