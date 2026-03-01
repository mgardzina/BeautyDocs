import { NextResponse } from "next/server";
import { generateConsentFormPdf } from "@/lib/pdfGenerator";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Pobierz formularz z podpisami RODO i głownym
    const form = await prisma.consentForm.findFirst({
      where: {
        AND: [
          { podpisDane: { not: null } },
          { podpisRodo: { not: null } }
        ]
      },
      orderBy: { createdAt: "desc" }
    });

    if (!form) {
      return NextResponse.json({ error: "Brak formularzy z podpisami w bazie danych, dodaj przynajmniej jeden aby sprawdzić podgląd." }, { status: 404 });
    }

    const pdfBuffer = await generateConsentFormPdf(form as any);

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="karta-zgody-test.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "Wystąpił błąd przy generowaniu PDF" }, { status: 500 });
  }
}
