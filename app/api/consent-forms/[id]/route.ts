import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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

    const form = await prisma.consentForm.findUnique({
      where: { id },
    });

    if (!form) {
      return NextResponse.json(
        { success: false, error: "Formularz nie znaleziony" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, form });
  } catch (error) {
    console.error("Błąd pobierania formularza:", error);
    return NextResponse.json(
      { success: false, error: "Błąd pobierania formularza" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    // Pola dozwolone do edycji
    const allowedFields = [
      "nazwaProduktu",
      "obszarZabiegu",
      "celEfektu",
      "email",
      "telefon",
      "ulica",
      "kodPocztowy",
      "miasto",
      "type",
      "przeciwwskazania",
      // Seria zabiegowa
      "planowanaIloscZabiegow",
      "odstepMiedzyZabiegami",
      "kolejneZabiegiOdstepy",
      "iloscProduktu",
      "osobaPrzeprowadzajacaZabieg",
    ];

    // Filtruj tylko dozwolone pola
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const form = await prisma.consentForm.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, form });
  } catch (error) {
    console.error("Błąd aktualizacji formularza:", error);
    return NextResponse.json(
      { success: false, error: "Błąd aktualizacji formularza" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    await prisma.consentForm.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Błąd usuwania formularza:", error);
    return NextResponse.json(
      { success: false, error: "Błąd usuwania formularza" },
      { status: 500 }
    );
  }
}
