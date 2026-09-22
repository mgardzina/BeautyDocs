import { NextResponse } from "next/server";
import { legacyDatabase } from "@/lib/legacy-database";
import { auth } from "@/lib/auth";

// GET - Lista notatek klientki
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

    const notes = await legacyDatabase.clientNote.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, notes });
  } catch (error) {
    console.error("Błąd pobierania notatek:", error);
    return NextResponse.json(
      { success: false, error: "Błąd pobierania notatek" },
      { status: 500 }
    );
  }
}

// POST - Dodanie notatki
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.content || body.content.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Treść notatki jest wymagana" },
        { status: 400 }
      );
    }

    // Walidacja kategorii
    const validCategories = ["NOTATKA", "ALERGIA", "UWAGA", "PREFERENCJA"];
    const category = validCategories.includes(body.category)
      ? body.category
      : "NOTATKA";

    const note = await legacyDatabase.clientNote.create({
      data: {
        content: body.content.trim(),
        category,
        clientId: id,
      },
    });

    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error("Błąd dodawania notatki:", error);
    return NextResponse.json(
      { success: false, error: "Błąd dodawania notatki" },
      { status: 500 }
    );
  }
}
