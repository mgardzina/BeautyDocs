import { config } from 'dotenv';
config();

import { prisma } from './lib/prisma';
import { generateConsentFormPdf } from './lib/pdfGenerator';
import fs from 'fs';

async function main() {
  const form = await prisma.consentForm.findFirst({
    orderBy: { createdAt: 'desc' },
    // Only get forms that have areas selected which might trigger the bug
    where: {
      obszarZabiegu: {
        not: undefined
      }
    }
  });

  if (!form) {
    console.log("No form found");
    return;
  }

  try {
    console.log("Testing PDF generation for form ID:", form.id);
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
    console.log("Success! PDF Buffer size:", pdfBuffer.byteLength);
  } catch (err) {
    console.error("Error generating PDF:", err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
