import { NextResponse } from "next/server";
import { legacyDatabase } from "@/lib/legacy-database";
import { auth } from "@/lib/auth";

// GET - Szczegóły klientki z formularzami i notatkami
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const client = await legacyDatabase.client.findUnique({
      where: { id },
      include: {
        forms: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            type: true,
            createdAt: true,
            obszarZabiegu: true,
            email: true,
            telefon: true,
            nazwaProduktu: true,
            osobaPrzeprowadzajacaZabieg: true,
            znieczulenie: true,
          },
        },
        notes: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Klientka nie znaleziona" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, client });
  } catch (error) {
    console.error("Błąd pobierania klientki:", error);
    return NextResponse.json(
      { success: false, error: "Błąd pobierania klientki" },
      { status: 500 }
    );
  }
}
